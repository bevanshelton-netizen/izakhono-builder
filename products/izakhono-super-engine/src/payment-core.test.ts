import assert from 'node:assert/strict';
import { IzakhonoPay, MemoryPaymentStore, type CreatePaymentInput, type PaymentProvider } from './payment-core.js';

const input: CreatePaymentInput = {
  externalTransactionId: 'ORDER-1001', amountMinor: 14900, currency: 'ZAR', description: 'Test purchase',
  requesterUrl: 'https://example.com/pay', callbackUrl: 'https://example.com/api/payment/callback',
  successPageUrl: 'https://example.com/success', failurePageUrl: 'https://example.com/failure',
};

let webhookTransaction = 'ORDER-1001';
let evidenceAmount = 14900;
let evidenceCurrency = 'ZAR';
let evidenceProviderPaymentId = 'provider-1';
const provider: PaymentProvider = {
  id: 'test-provider',
  async createPaymentLink() { return { paymentIntentId: '', provider: 'test-provider', providerPaymentId: 'provider-1', url: 'https://pay.example/1' }; },
  async verifyWebhook() { return true; },
  parseWebhook() { return { provider: 'test-provider', providerPaymentId: 'provider-1', externalTransactionId: webhookTransaction, status: 'SUCCESS', responseCode: '00' }; },
  async verifyPaymentEvidence(webhook, intent) { return { ...webhook, providerPaymentId: evidenceProviderPaymentId, amountMinor: evidenceAmount, currency: evidenceCurrency }; },
};

const store = new MemoryPaymentStore();
const pay = new IzakhonoPay(store, provider, async (context) => context.principalId === 'principal-1' ? 'merchant-1' : '');
const created = await pay.createPayment(input, { principalId: 'principal-1' });
assert.equal(created.intent.status, 'pending');
assert.equal(created.intent.amountMinor, 14900);
assert.equal(created.link.url, 'https://pay.example/1');

const paid = await pay.processWebhook('{}', '/api/payment/callback', 'valid');
assert.equal(paid.status, 'paid');
await assert.rejects(() => store.update(created.intent.id, { merchantId: 'merchant-attacker' }), /immutable/);
evidenceAmount = 1;
await assert.rejects(() => pay.processWebhook('{}', '/api/payment/callback', 'valid'), /amount does not match/);
evidenceAmount = 14900;
evidenceCurrency = 'USD';
await assert.rejects(() => pay.processWebhook('{}', '/api/payment/callback', 'valid'), /currency does not match/);
evidenceCurrency = 'ZAR';
evidenceProviderPaymentId = 'provider-attacker';
await assert.rejects(() => pay.processWebhook('{}', '/api/payment/callback', 'valid'), /references/);

await assert.rejects(() => pay.createPayment(input, { principalId: 'principal-1' }), /Duplicate external transaction ID/);
webhookTransaction = 'ORDER-DOES-NOT-EXIST';
await assert.rejects(() => pay.processWebhook('{}', '/api/payment/callback', 'valid'), /Unknown payment transaction/);

assert.equal(created.intent.merchantId, 'merchant-1');
await assert.rejects(() => pay.createPayment({ ...input, externalTransactionId: 'ORDER-1002' }, { principalId: 'unmapped' }), /not mapped/);
console.log('IZAKHONO PAY core tests passed');
