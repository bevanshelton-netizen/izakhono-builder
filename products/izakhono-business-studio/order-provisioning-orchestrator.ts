import { createProvisionerJob, markValidated, startJob, recordEvidence, verifyLive, type Blueprint, type Capability, type ProvisionerJob } from './provisioner-runtime';
import { advance, assertPublicActivation, createControlPlaneRecord, fail, type ControlPlaneRecord } from './provisioning-control-plane';

export type PaymentProvider = 'ikhokha' | 'paystack' | 'payfast';

export interface PaidOrder {
  orderId: string;
  customerId: string;
  merchantSlug: string;
  blueprint: Blueprint;
  requestedCapabilities: Capability[];
  payment: { intentId: string; amountMinor: number; currency: string };
}

export interface PaymentVerificationRequest {
  orderId: string;
  merchantSlug: string;
  intentId: string;
  amountMinor: number;
  currency: string;
}

export interface VerifiedPaymentReceipt extends PaymentVerificationRequest {
  status: 'paid';
  provider: PaymentProvider;
  providerTransactionId: string;
  paidAt: string;
  verifiedAt: string;
  verificationSource: 'IZAKHONO_PAY_SERVER';
}

export interface PaymentVerifier {
  verifyPayment(request: PaymentVerificationRequest): Promise<VerifiedPaymentReceipt | null>;
}

export interface RuntimeAdapter {
  selectNode(order: PaidOrder): Promise<{ nodeId: string; routeClass: 'owned' | 'external-resilience' | 'external-auxiliary' }>;
  provisionNode(order: PaidOrder, nodeId: string): Promise<string>;
  health(nodeId: string): Promise<string>;
  deploy(order: PaidOrder, nodeId: string): Promise<string>;
  edge(order: PaidOrder, nodeId: string): Promise<string>;
  tls(order: PaidOrder, nodeId: string): Promise<string>;
  dns(order: PaidOrder, nodeId: string): Promise<string>;
  smoke(order: PaidOrder, nodeId: string): Promise<string>;
  rollbackReady(order: PaidOrder, nodeId: string): Promise<string>;
}

export interface ProvisioningResult {
  orderId: string;
  job: ProvisionerJob;
  controlPlane: ControlPlaneRecord;
  paymentReceipt: VerifiedPaymentReceipt;
  handover: { customerId: string; release: string; verifiedAt: string };
}

function assertPaymentReceipt(order: PaidOrder, receipt: VerifiedPaymentReceipt | null): asserts receipt is VerifiedPaymentReceipt {
  if (!receipt || receipt.status !== 'paid') throw new Error('payment_not_verified_server_side');
  if (receipt.verificationSource !== 'IZAKHONO_PAY_SERVER') throw new Error('untrusted_payment_verification_source');
  if (
    receipt.orderId !== order.orderId ||
    receipt.merchantSlug !== order.merchantSlug ||
    receipt.intentId !== order.payment.intentId ||
    receipt.amountMinor !== order.payment.amountMinor ||
    receipt.currency !== order.payment.currency
  ) throw new Error('payment_verification_mismatch');
  if (!['ikhokha', 'paystack', 'payfast'].includes(receipt.provider)) throw new Error('unsupported_payment_provider');
  if (!receipt.providerTransactionId || !receipt.providerTransactionId.trim()) throw new Error('payment_provider_reference_required');
  if (!receipt.paidAt || !Number.isFinite(Date.parse(receipt.paidAt))) throw new Error('payment_paid_at_required');
  if (!receipt.verifiedAt || !Number.isFinite(Date.parse(receipt.verifiedAt))) throw new Error('payment_verified_at_required');
}

export async function provisionPaidOrder(
  order: PaidOrder,
  adapter: RuntimeAdapter,
  paymentVerifier: PaymentVerifier,
  now = new Date().toISOString()
): Promise<ProvisioningResult> {
  if (!paymentVerifier || typeof paymentVerifier.verifyPayment !== 'function') {
    throw new Error('payment_verifier_required');
  }
  if (!order.orderId?.trim() || !order.customerId?.trim() || !order.merchantSlug?.trim()) {
    throw new Error('order_identity_required');
  }
  if (!order.payment?.intentId?.trim()) throw new Error('payment_intent_id_required');
  if (!Number.isSafeInteger(order.payment.amountMinor) || order.payment.amountMinor <= 0) {
    throw new Error('payment_expected_amount_invalid');
  }
  if (!/^[A-Z]{3}$/.test(order.payment.currency)) throw new Error('payment_expected_currency_invalid');

  const verificationRequest: PaymentVerificationRequest = {
    orderId: order.orderId,
    merchantSlug: order.merchantSlug,
    intentId: order.payment.intentId,
    amountMinor: order.payment.amountMinor,
    currency: order.payment.currency
  };
  const paymentReceipt = await paymentVerifier.verifyPayment(verificationRequest);
  assertPaymentReceipt(order, paymentReceipt);

  const jobId = 'order:' + order.orderId;
  let job = createProvisionerJob(order.blueprint, order.requestedCapabilities, jobId, now);
  job = markValidated(job, now);
  job = startJob(job, now);
  let control = await selectAndRecord(order, adapter, now);
  try {
    const node = control.target.nodeId;
    const refs: Partial<Record<Capability, string>> = {};
    refs.PROVISIONING = await adapter.provisionNode(order, node);
    await adapter.health(node);
    control = advance(control, { health: true }, new Date().toISOString());
    refs.WEBSITE = await adapter.deploy(order, node);
    control = advance(control, { deployment: true }, new Date().toISOString());
    refs.DOMAIN = await adapter.edge(order, node);
    control = advance(control, { edge: true }, new Date().toISOString());
    refs.SSL = await adapter.tls(order, node);
    control = advance(control, { tls: true }, new Date().toISOString());
    refs.DNS = await adapter.dns(order, node);
    control = advance(control, { dns: true }, new Date().toISOString());
    refs.PROVISIONING = refs.PROVISIONING + '|smoke:' + await adapter.smoke(order, node);
    control = advance(control, { smokeTest: true }, new Date().toISOString());
    refs.PROVISIONING = refs.PROVISIONING + '|rollback:' + await adapter.rollbackReady(order, node);
    control = advance(control, { rollbackReady: true }, new Date().toISOString());
    for (const capability of order.requestedCapabilities) job = recordEvidence(job, capability, 'PASSED', refs[capability]);
    assertPublicActivation(control);
    const verifiedAt = new Date().toISOString();
    job = verifyLive(job, control.release + ':verified', verifiedAt);
    return {
      orderId: order.orderId,
      job,
      controlPlane: control,
      paymentReceipt,
      handover: { customerId: order.customerId, release: control.release, verifiedAt }
    };
  } catch (error) {
    control = fail(control, error instanceof Error ? error.message : String(error));
    throw Object.assign(new Error('provisioning failed for ' + order.orderId + ': ' + control.failureReason), { controlPlane: control });
  }
}

async function selectAndRecord(order: PaidOrder, adapter: RuntimeAdapter, now: string): Promise<ControlPlaneRecord> {
  const node = await adapter.selectNode(order);
  return createControlPlaneRecord({
    release: order.orderId + ':' + order.blueprint.schemaVersion,
    orderId: order.orderId,
    nodeId: node.nodeId,
    routeClass: node.routeClass,
    now
  });
}
