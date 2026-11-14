import assert from 'node:assert/strict';
import { IzakhonoPay, MemoryPaymentStore, type CreatePaymentInput, type PaymentProvider } from './payment-core.js';

const input: CreatePaymentInput = {
  externalTransactionId: 'ORDER-1001', amountMinor: 14900, currency: 'ZAR', description: 'Test purchase',
  requesterUrl: 'https://example.com/pay', callbackUrl: 'https://example.com/api/payment/callback',
  successPageUrl: 'https://example.com/success', failurePageUrl: 'https://example.com/failure',
};

let webhookTransaction = 'ORDER-1001';
const provider: PaymentProvider = {
  id: 'test-provider',
  async createPaymentLink() { return { paymentIntentId: '', provider: 'test-provider', providerPaymentId: 'provider-1', url: 'https://pay.example/1' }; },
  async verifyWebhook() { return true; },
  parseWebhook() { return { provider: 'test-provider', providerPaymentId: 'provider-1', externalTransactionId: webhookTransaction, status: 'SUCCESS', responseCode: '00' }; },
};

const store = new MemoryPaymentStore();
const pay = new IzakhonoPay(store, provider);
const created = await pay.createPayment(input);
assert.equal(created.intent.status, 'pending');
assert.equal(created.intent.amountMinor, 14900);
assert.equal(created.link.url, 'https://pay.example/1');

const paid = await pay.processWebhook('{}', '/api/payment/callback', 'valid');
assert.equal(paid.status, 'paid');

await assert.rejects(() => pay.createPayment(input), /Duplicate external transaction ID/);
webhookTransaction = 'ORDER-DOES-NOT-EXIST';
await assert.rejects(() => pay.processWebhook('{}', '/api/payment/callback', 'valid'), /Unknown payment transaction/);

const orderEvents: string[] = [];
const orderStore = {
  async createOrGet(order: Record<string, unknown>) {
    orderEvents.push(`snapshot:${String(order.paymentIntentId)}`);
    return order as never;
  },
  async getByPaymentIntentId() { return undefined; },
};
const orderedProvider: PaymentProvider = {
  ...provider,
  async createPaymentLink() {
    orderEvents.push('payment-link');
    return { paymentIntentId: '', provider: 'test-provider', providerPaymentId: 'provider-2', url: 'https://pay.example/2' };
  },
};
const orderedPay = new IzakhonoPay(new MemoryPaymentStore(), orderedProvider, orderStore);
const ordered = await orderedPay.createPayment({
  ...input,
  externalTransactionId: 'ORDER-WITH-SNAPSHOT',
  checkoutOrder: { orderId: 'ord_1', customerId: 'customer_1', domain: 'example.co.za', productId: 'host-starter', idempotencyKey: 'idem_1' },
});
assert.equal(ordered.intent.status, 'pending');
assert.match(orderEvents[0], /^snapshot:pay_/);
assert.equal(orderEvents[1], 'payment-link');

let providerCalled = false;
const failingPay = new IzakhonoPay(new MemoryPaymentStore(), {
  ...orderedProvider,
  async createPaymentLink() { providerCalled = true; throw new Error('should not be called'); },
}, {
  async createOrGet() { throw new Error('snapshot storage unavailable'); },
  async getByPaymentIntentId() { return undefined; },
});
await assert.rejects(() => failingPay.createPayment({
  ...input, externalTransactionId: 'ORDER-SNAPSHOT-FAIL',
  checkoutOrder: { orderId: 'ord_2', customerId: 'customer_1', domain: 'example.co.za', productId: 'host-starter', idempotencyKey: 'idem_2' },
}), /snapshot storage unavailable/);
assert.equal(providerCalled, false);

console.log('IZAKHONO PAY core tests passed');
