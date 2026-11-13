import assert from 'node:assert/strict';
import { PaidProvisioningBridge } from './payment-bridge.mjs';

class AtomicMemoryStore {
  records = new Map();
  async createOrGetByIdempotencyKey(record) {
    const existing = this.records.get(record.idempotency_key);
    if (!existing) {
      this.records.set(record.idempotency_key, structuredClone(record));
      return { outcome: 'created', record: structuredClone(record) };
    }
    const same = existing.payment?.payment_intent_id === record.payment?.payment_intent_id &&
      existing.payment?.external_transaction_id === record.payment?.external_transaction_id &&
      existing.payment?.amount_minor === record.payment?.amount_minor &&
      existing.payment?.currency === record.payment?.currency &&
      existing.customer_id === record.customer_id &&
      existing.domain === record.domain;
    return { outcome: same ? 'existing' : 'conflict', record: structuredClone(existing) };
  }
}

const payment = {
  id: 'pay_123', externalTransactionId: 'ORDER-1001', provider: 'ikhokha',
  providerPaymentId: 'paylink_456', amountMinor: 14900, currency: 'ZAR', status: 'paid',
};
const order = {
  customerId: 'customer_1', domain: 'example.co.za',
  idempotencyKey: 'checkout_ORDER-1001', expectedAmountMinor: 14900, currency: 'ZAR',
};
const store = new AtomicMemoryStore();
const bridge = new PaidProvisioningBridge(store);

const first = await bridge.acceptPaidPayment({ payment, order });
assert.equal(first.created, true);
assert.equal(first.record.state, 'PAYMENT_VERIFIED');
assert.equal(first.record.public_live, false);
assert.equal(first.record.payment.provider, 'ikhokha');

const duplicate = await bridge.acceptPaidPayment({ payment, order });
assert.equal(duplicate.created, false);
assert.equal(duplicate.record.id, first.record.id);
assert.equal(store.records.size, 1);

await assert.rejects(
  () => bridge.acceptPaidPayment({ payment: { ...payment, status: 'pending' }, order }),
  /verified paid payment/,
);
await assert.rejects(
  () => bridge.acceptPaidPayment({ payment: { ...payment, amountMinor: 100 }, order }),
  /amount does not match/,
);
await assert.rejects(
  () => bridge.acceptPaidPayment({ payment: { ...payment, currency: 'USD' }, order }),
  /currency does not match/,
);
await assert.rejects(
  () => bridge.acceptPaidPayment({
    payment: { ...payment, id: 'pay_different', externalTransactionId: 'ORDER-OTHER' },
    order,
  }),
  /already bound/,
);

const nextOrder = { ...order, idempotencyKey: 'checkout_ORDER-1002', domain: 'second.co.za' };
const forged = await bridge.acceptPaidPayment({
  payment: { ...payment, id: 'pay_124', externalTransactionId: 'ORDER-1002' },
  order: nextOrder,
});
assert.equal(forged.record.state, 'PAYMENT_VERIFIED');
assert.equal(forged.record.public_live, false);

console.log('IZAKHONO HOST paid-provisioning bridge tests: PASS');
