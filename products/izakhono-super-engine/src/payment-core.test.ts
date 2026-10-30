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

console.log('IZAKHONO PAY core tests passed');
