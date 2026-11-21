import assert from 'node:assert/strict';
import { IzakhonoPay, MemoryPaymentStore, type CreatePaymentInput, type PaymentProvider } from './payment-core.js';
import { MemoryPaymentLedgerStore, IzakhonoPaymentLedger } from './payment-ledger.js';
import { PaymentWorkflow } from './payment-workflow.js';
import { ServiceBus } from './service-bus.js';
import type { EngineModuleId } from './types.js';


async function main() {
const input: CreatePaymentInput = {
  externalTransactionId: 'ORDER-WORKFLOW-1',
  amountMinor: 2500,
  currency: 'ZAR',
  requesterUrl: 'https://example.com/pay',
  callbackUrl: 'https://example.com/callback',
  successPageUrl: 'https://example.com/success',
  failurePageUrl: 'https://example.com/failure',
};
const provider: PaymentProvider = {
  id: 'test-provider',
  async createPaymentLink() { return { paymentIntentId: '', provider: 'test-provider', providerPaymentId: 'provider-1', url: 'https://pay.example/1' }; },
  async verifyWebhook() { return true; },
  parseWebhook() { return { provider: 'test-provider', providerPaymentId: 'provider-1', externalTransactionId: 'ORDER-WORKFLOW-1', status: 'SUCCESS', responseCode: '00' }; },
  async verifyPaymentEvidence(webhook, intent) { return { ...webhook, amountMinor: intent.amountMinor, currency: intent.currency }; },
};
const store = new MemoryPaymentStore();
const pay = new IzakhonoPay(store, provider, async (context) => context.principalId === 'verified-principal' ? { merchantId: 'merchant-canonical', serviceId: 'school-commerce' } : { merchantId: '', serviceId: '' });
const ledgerStore = new MemoryPaymentLedgerStore();
const ledger = new IzakhonoPaymentLedger(ledgerStore);
const bus = new ServiceBus(['payments', 'provisioning'] as EngineModuleId[]);
let emittedMerchant = '';
bus.subscribe('provisioning' as EngineModuleId, async (message) => {
  emittedMerchant = (message.payload as { merchantId: string }).merchantId;
});
const workflow = new PaymentWorkflow(pay, ledger, bus);

const created = await pay.createPayment(input, { principalId: 'verified-principal' });
assert.equal(created.intent.merchantId, 'merchant-canonical');
assert.equal(created.intent.serviceId, 'school-commerce');
const paid = await workflow.processConfirmedWebhook('{}', '/callback', 'valid');
assert.equal(paid.status, 'paid');
assert.equal(emittedMerchant, 'merchant-canonical');
assert.ok(await ledgerStore.getMerchantAccount('merchant-canonical', 'ZAR'));
assert.equal(await ledgerStore.getMerchantAccount('merchant-attacker', 'ZAR'), undefined);

const repeated = await workflow.handlePaid({ ...paid, merchantId: 'merchant-attacker' });
assert.equal(repeated?.merchantId, 'merchant-canonical');
assert.equal((await ledgerStore.listTransactions()).length, 1);
console.log('payment-workflow.test.ts: ok');
}

void main();
