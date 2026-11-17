import { strict as assert } from 'node:assert';
import { provisionPaidOrder, type PaymentVerifier, type RuntimeAdapter, type VerifiedPaymentReceipt, type PaidOrder } from './order-provisioning-orchestrator';
import type { Blueprint } from './provisioner-runtime';

const blueprint: Blueprint = {
  schemaVersion: '1.0',
  business: { name: 'Test Business', description: 'Provisioning test' },
  score: 100,
  workflow: ['WEBSITE', 'DOMAIN', 'DNS', 'SSL', 'PROVISIONING'],
  outputs: ['site'],
  status: 'PROVISIONING_PENDING'
};

let selectNodeCalls = 0;
const adapter: RuntimeAdapter = {
  async selectNode() { selectNodeCalls += 1; return { nodeId: 'node-test-01', routeClass: 'external-resilience' }; },
  async provisionNode() { return 'provisioned'; },
  async health() { return 'healthy'; },
  async deploy() { return 'deployed'; },
  async edge() { return 'edge-ready'; },
  async tls() { return 'tls-ready'; },
  async dns() { return 'dns-ready'; },
  async smoke() { return 'smoke-passed'; },
  async rollbackReady() { return 'rollback-ready'; }
};

const order: PaidOrder = {
  orderId: 'ORD-100',
  customerId: 'CUS-1',
  merchantSlug: 'business-studio',
  blueprint,
  requestedCapabilities: [...blueprint.workflow],
  payment: { intentId: 'pi_100', amountMinor: 14900, currency: 'ZAR' }
};

const receipt: VerifiedPaymentReceipt = {
  orderId: 'ORD-100',
  merchantSlug: 'business-studio',
  intentId: 'pi_100',
  amountMinor: 14900,
  currency: 'ZAR',
  status: 'paid',
  provider: 'ikhokha',
  providerTransactionId: 'PAYLINK-100',
  paidAt: '2026-11-17T12:00:00.000Z',
  verifiedAt: '2026-11-17T12:00:01.000Z',
  verificationSource: 'IZAKHONO_PAY_SERVER'
};

const verifier: PaymentVerifier = {
  async verifyPayment(request) {
    assert.equal(request.orderId, order.orderId);
    assert.equal(request.merchantSlug, order.merchantSlug);
    assert.equal(request.intentId, order.payment.intentId);
    assert.equal(request.amountMinor, order.payment.amountMinor);
    assert.equal(request.currency, order.payment.currency);
    return receipt;
  }
};

const result = await provisionPaidOrder(order, adapter, verifier, '2026-11-17T12:00:02.000Z');
assert.equal(result.controlPlane.state, 'LIVE_VERIFIED');
assert.equal(result.job.status, 'LIVE_VERIFIED');
assert.equal(result.handover.customerId, 'CUS-1');
assert.equal(result.paymentReceipt.providerTransactionId, 'PAYLINK-100');

const rejectedVerifier: PaymentVerifier = { async verifyPayment() { return null; } };
const callsBeforeReject = selectNodeCalls;
await assert.rejects(
  () => provisionPaidOrder({ ...order, orderId: 'ORD-101' }, adapter, rejectedVerifier),
  /payment_not_verified_server_side/
);
assert.equal(selectNodeCalls, callsBeforeReject, 'provisioning must not start before payment verification');

const mismatchedVerifier: PaymentVerifier = {
  async verifyPayment() { return { ...receipt, amountMinor: 100 } as VerifiedPaymentReceipt; }
};
await assert.rejects(
  () => provisionPaidOrder(order, adapter, mismatchedVerifier),
  /payment_verification_mismatch/
);

const legacyClientBoolean = {
  ...order,
  payment: { verified: true, reference: 'client-supplied' }
} as unknown as PaidOrder;
await assert.rejects(
  () => provisionPaidOrder(legacyClientBoolean, adapter, undefined as unknown as PaymentVerifier),
  /payment_verifier_required/
);

console.log('order-provisioning-orchestrator: PASS');
