import { createProvisionerJob, markValidated, startJob, recordEvidence, verifyLive, type Blueprint, type Capability, type ProvisionerJob } from './provisioner-runtime';
import { advance, assertPublicActivation, createControlPlaneRecord, fail, type ControlPlaneRecord } from './provisioning-control-plane';

/**
 * Order data is descriptive only. It is never accepted as payment proof.
 * The verifier must query IZAKHONO PAY server-to-server using its own
 * server-held credentials and bind the confirmed payment to every order field.
 */
export interface PaidOrder {
  orderId:string;
  customerId:string;
  merchantId:string;
  amountMinor:number;
  currency:string;
  blueprint:Blueprint;
  requestedCapabilities:Capability[];
  payment:{reference:string};
}
export interface VerifiedPaymentEvidence {
  verified:true;
  status:'paid'|'settled';
  orderId:string;
  customerId:string;
  merchantId:string;
  amountMinor:number;
  currency:string;
  paymentReference:string;
  providerTransactionId:string;
  evidenceId:string;
}
export interface PaymentEvidenceVerifier {
  verify(input:{orderId:string;customerId:string;merchantId:string;amountMinor:number;currency:string;paymentReference:string}):Promise<VerifiedPaymentEvidence>;
}
export interface RuntimeAdapter {
  selectNode(order:PaidOrder):Promise<{nodeId:string;routeClass:'owned'|'external-resilience'|'external-auxiliary'}>;
  provisionNode(order:PaidOrder,nodeId:string):Promise<string>;
  health(nodeId:string):Promise<string>;
  deploy(order:PaidOrder,nodeId:string):Promise<string>;
  edge(order:PaidOrder,nodeId:string):Promise<string>;
  tls(order:PaidOrder,nodeId:string):Promise<string>;
  dns(order:PaidOrder,nodeId:string):Promise<string>;
  smoke(order:PaidOrder,nodeId:string):Promise<string>;
  rollbackReady(order:PaidOrder,nodeId:string):Promise<string>;
}
export interface ProvisioningResult { orderId:string; job:ProvisionerJob; controlPlane:ControlPlaneRecord; handover:{customerId:string;release:string;verifiedAt:string}; paymentEvidence:{evidenceId:string;providerTransactionId:string;status:'paid'|'settled'}; }

export async function provisionPaidOrder(order:PaidOrder,adapter:RuntimeAdapter,paymentVerifier:PaymentEvidenceVerifier,now=new Date().toISOString()):Promise<ProvisioningResult> {
  if(!order.orderId.trim()||!order.customerId.trim()||!order.merchantId.trim()) throw new Error('order, customer and merchant identity are required');
  if(!Number.isSafeInteger(order.amountMinor)||order.amountMinor<=0) throw new Error('order amount must be a positive integer in minor currency units');
  if(!/^[A-Z]{3}$/.test(order.currency)) throw new Error('order currency must be an ISO 4217 code');
  const paymentReference=order.payment.reference.trim();
  if(!paymentReference) throw new Error('payment reference is required');
  // This server-side lookup, not a caller-controlled Boolean, is the sole
  // authorization source for paid-order provisioning.
  const evidence=await paymentVerifier.verify({orderId:order.orderId,customerId:order.customerId,merchantId:order.merchantId,amountMinor:order.amountMinor,currency:order.currency,paymentReference});
  if(!evidence||evidence.verified!==true||!['paid','settled'].includes(evidence.status)) throw new Error('payment must be independently confirmed as paid or settled');
  if(evidence.orderId!==order.orderId||evidence.customerId!==order.customerId||evidence.merchantId!==order.merchantId) throw new Error('verified payment identity does not match the order');
  if(evidence.amountMinor!==order.amountMinor||evidence.currency!==order.currency) throw new Error('verified payment amount or currency does not match the order');
  if(evidence.paymentReference!==paymentReference||!evidence.providerTransactionId?.trim()||!evidence.evidenceId?.trim()) throw new Error('verified payment evidence is incomplete or mismatched');
  const jobId=`order:${order.orderId}`;
  let job=createProvisionerJob(order.blueprint,order.requestedCapabilities,jobId,now);
  job=markValidated(job,now); job=startJob(job,now);
  let control=await selectAndRecord(order,adapter,now);
  try {
    const node=control.target.nodeId;
    const refs:Partial<Record<Capability,string>>={};
    refs.PROVISIONING=await adapter.provisionNode(order,node);
    await adapter.health(node); control=advance(control,{health:true},new Date().toISOString());
    refs.WEBSITE=await adapter.deploy(order,node); control=advance(control,{deployment:true},new Date().toISOString());
    refs.DOMAIN=await adapter.edge(order,node); control=advance(control,{edge:true},new Date().toISOString());
    refs.SSL=await adapter.tls(order,node); control=advance(control,{tls:true},new Date().toISOString());
    refs.DNS=await adapter.dns(order,node); control=advance(control,{dns:true},new Date().toISOString());
    refs.PROVISIONING=`${refs.PROVISIONING}|smoke:${await adapter.smoke(order,node)}`; control=advance(control,{smokeTest:true},new Date().toISOString());
    refs.PROVISIONING=`${refs.PROVISIONING}|rollback:${await adapter.rollbackReady(order,node)}`; control=advance(control,{rollbackReady:true},new Date().toISOString());
    for(const capability of order.requestedCapabilities) job=recordEvidence(job,capability,'PASSED',refs[capability]);
    assertPublicActivation(control);
    const verifiedAt=new Date().toISOString();
    job=verifyLive(job,`${control.release}:verified`,verifiedAt);
    return {orderId:order.orderId,job,controlPlane:control,handover:{customerId:order.customerId,release:control.release,verifiedAt},paymentEvidence:{evidenceId:evidence.evidenceId,providerTransactionId:evidence.providerTransactionId,status:evidence.status}};
  } catch(error) {
    control=fail(control,error instanceof Error?error.message:String(error));
    throw Object.assign(new Error(`provisioning failed for ${order.orderId}: ${control.failureReason}`),{controlPlane:control});
  }
}

async function selectAndRecord(order:PaidOrder,adapter:RuntimeAdapter,now:string):Promise<ControlPlaneRecord> {
  const node=await adapter.selectNode(order);
  return createControlPlaneRecord({release:`${order.orderId}:${order.blueprint.schemaVersion}`,orderId:order.orderId,nodeId:node.nodeId,routeClass:node.routeClass,now});
}
