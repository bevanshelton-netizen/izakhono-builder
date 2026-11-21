import assert from 'node:assert/strict';
import { IKhokhaProvider, IzakhonoPay, MemoryPaymentStore, type CreatePaymentInput, type PaymentProvider } from './payment-core.js';


async function main() {
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
const pay = new IzakhonoPay(store, provider, async (context) => context.principalId === 'principal-1' ? { merchantId: 'merchant-1', serviceId: 'digital-service' } : { merchantId: '', serviceId: '' });
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
const statusRequests: Array<{ url: string; init?: RequestInit }> = [];
const ikh = new IKhokhaProvider({ appId: 'app-id', appSecret: 'server-secret', entityId: 'entity-1', baseUrl: 'https://api.ikhokha.test' }, async (url, init) => {
  statusRequests.push({ url: String(url), init });
  return Response.json({ paylinkID: 'provider-1', status: 'PAID', amount: 14900 });
});
const ikhIntent = { ...created.intent, provider: 'ikhokha' };
const ikhWebhook = ikh.parseWebhook(JSON.stringify({ paylinkID: 'provider-1', externalTransactionID: 'ORDER-1001', status: 'SUCCESS', responseCode: '00' }));
const evidence = await ikh.verifyPaymentEvidence(ikhWebhook, ikhIntent);
assert.equal(evidence.amountMinor, 14900);
assert.equal(evidence.currency, 'ZAR');
assert.equal(statusRequests.length, 1);
assert.match(statusRequests[0].url, /getStatus\/external\?externalReference=ORDER-1001/);
assert.equal(new Headers(statusRequests[0].init?.headers).get('IK-APPID'), 'app-id');
console.log('IZAKHONO PAY core tests passed');
}

void main();
