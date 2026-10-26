import { createProvisionerJob, markValidated, startJob, recordEvidence, verifyLive, type Blueprint, type Capability, type ProvisionerJob } from './provisioner-runtime';
import { advance, assertPublicActivation, createControlPlaneRecord, fail, type ControlPlaneRecord } from './provisioning-control-plane';

export interface PaidOrder { orderId:string; customerId:string; blueprint:Blueprint; requestedCapabilities:Capability[]; payment:{verified:boolean;reference:string}; }
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
export interface ProvisioningResult { orderId:string; job:ProvisionerJob; controlPlane:ControlPlaneRecord; handover?:{customerId:string;release:string;verifiedAt:string}; }

export async function provisionPaidOrder(order:PaidOrder,adapter:RuntimeAdapter,now=new Date().toISOString()):Promise<ProvisioningResult> {
  if(!order.payment.verified) throw new Error('payment must be verified before provisioning');
  if(!order.payment.reference.trim()) throw new Error('payment verification reference is required');
  const jobId=`order:${order.orderId}`;
  let job=createProvisionerJob(order.blueprint,order.requestedCapabilities,jobId,now);
  job=markValidated(job,now); job=startJob(job,now);
  let control=await selectAndRecord(order,adapter,now);
  try {
    const node=control.target.nodeId;
    const nodeRef=await adapter.provisionNode(order,node); control=advance(control,{health:false},new Date().toISOString());
    job=recordEvidence(job,'PROVISIONING','PASSED',nodeRef);
    const healthRef=await adapter.health(node); control=advance(control,{health:true},new Date().toISOString()); job=recordEvidence(job,'PROVISIONING','PASSED',healthRef);
    const deploymentRef=await adapter.deploy(order,node); control=advance(control,{deployment:true},new Date().toISOString()); job=recordEvidence(job,'WEBSITE','PASSED',deploymentRef);
    const edgeRef=await adapter.edge(order,node); control=advance(control,{edge:true},new Date().toISOString()); job=recordEvidence(job,'DOMAIN','PASSED',edgeRef);
    const tlsRef=await adapter.tls(order,node); control=advance(control,{tls:true},new Date().toISOString()); job=recordEvidence(job,'SSL','PASSED',tlsRef);
    const dnsRef=await adapter.dns(order,node); control=advance(control,{dns:true},new Date().toISOString()); job=recordEvidence(job,'DNS','PASSED',dnsRef);
    const smokeRef=await adapter.smoke(order,node); control=advance(control,{smokeTest:true},new Date().toISOString()); job=recordEvidence(job,'PROVISIONING','PASSED',smokeRef);
    const rollbackRef=await adapter.rollbackReady(order,node); control=advance(control,{rollbackReady:true},new Date().toISOString()); job=recordEvidence(job,'PROVISIONING','PASSED',rollbackRef);
    const verifiedAt=new Date().toISOString();
    assertPublicActivation(control);
    job=verifyLive(job,`${control.release}:${smokeRef}`,verifiedAt);
    return {orderId:order.orderId,job,controlPlane:control,handover:{customerId:order.customerId,release:control.release,verifiedAt}};
  } catch(error) {
    control=fail(control,error instanceof Error?error.message:String(error));
    throw Object.assign(new Error(`provisioning failed for ${order.orderId}: ${control.failureReason}`),{controlPlane:control});
  }
}

async function selectAndRecord(order:PaidOrder,adapter:RuntimeAdapter,now:string):Promise<ControlPlaneRecord> {
  const node=await adapter.selectNode(order);
  return createControlPlaneRecord({release:`${order.orderId}:${order.blueprint.schemaVersion}`,orderId:order.orderId,nodeId:node.nodeId,routeClass:node.routeClass,now});
}
