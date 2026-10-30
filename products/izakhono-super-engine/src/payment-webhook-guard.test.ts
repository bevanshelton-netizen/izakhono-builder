import assert from 'node:assert/strict';
import { IzakhonoPay, MemoryPaymentStore, type CreatePaymentInput, type PaymentProvider } from './payment-core.js';
import { MemoryPaymentEventStore } from './payment-events.js';
import { PaymentWebhookGuard } from './payment-webhook-guard.js';

const input: CreatePaymentInput = {
  externalTransactionId: 'ORDER-WEBHOOK-1', amountMinor: 1000, currency: 'ZAR',
  requesterUrl: 'https://example.com/pay', callbackUrl: 'https://example.com/callback',
  successPageUrl: 'https://example.com/success', failurePageUrl: 'https://example.com/failure',
};

let outcome: 'SUCCESS' | 'FAILURE' = 'SUCCESS';
let responseCode = '00';
let providerPaymentId = 'provider-1';
const provider: PaymentProvider = {
  id: 'test-provider',
  async createPaymentLink() { return { paymentIntentId: '', provider: 'test-provider', providerPaymentId: 'provider-1', url: 'https://pay.example/1' }; },
  async verifyWebhook() { return true; },
  parseWebhook() {
    return { provider: 'test-provider', providerPaymentId, externalTransactionId: 'ORDER-WEBHOOK-1', status: outcome, responseCode };
  },
};

const payments = new MemoryPaymentStore();
const pay = new IzakhonoPay(payments, provider);
await pay.createPayment(input);
const events = new MemoryPaymentEventStore();
const guard = new PaymentWebhookGuard(payments, events, provider);

const first = await guard.process('{}', '/callback', 'valid');
assert.equal(first.status, 'paid');

const duplicate = await guard.process('{}', '/callback', 'valid');
assert.equal(duplicate.status, 'paid');

outcome = 'FAILURE';
responseCode = '99';
providerPaymentId = 'provider-evil';
await assert.rejects(() => guard.process('{}', '/callback', 'valid'), /Contradictory duplicate/);
assert.equal((await payments.getByExternalTransactionId('ORDER-WEBHOOK-1'))?.status, 'paid');

console.log('payment-webhook-guard.test.ts: ok');
