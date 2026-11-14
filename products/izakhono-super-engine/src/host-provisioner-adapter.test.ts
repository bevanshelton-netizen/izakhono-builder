import assert from 'node:assert/strict';
import { HostProvisionerAdapter } from './host-provisioner-adapter.js';
import type { PaymentIntent } from './payment-core.js';
import type { FulfillmentJob } from './payment-fulfillment.js';

const payment: PaymentIntent = {
  id: 'pay_test_1', externalTransactionId: 'ORDER-1', amountMinor: 14900, currency: 'ZAR',
  status: 'paid', provider: 'ikhokha', providerPaymentId: 'paylink-1',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
const job: FulfillmentJob = {
  id: 'fulfill_1', paymentIntentId: payment.id, merchantId: 'merchant_1', serviceId: 'host',
  status: 'running', attempts: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
const order = {
  customerId: 'customer_1', domain: 'customer.example', expectedAmountMinor: 14900,
  currency: 'ZAR', idempotencyKey: 'checkout_1',
};

let sent: RequestInit | undefined;
const adapter = new HostProvisionerAdapter({
  endpoint: 'https://host.internal',
  bridgeToken: 'server-only-secret',
  resolveOrder: async () => order,
  fetcher: async (_input, init) => {
    sent = init;
    return new Response(JSON.stringify({ ok: true, state: 'PAYMENT_VERIFIED' }), {
      status: 201, headers: { 'content-type': 'application/json' },
    });
  },
});
await adapter.provision({ job, payment });
assert.equal(sent?.method, 'POST');
assert.equal((sent?.headers as Record<string, string>)['x-izakhono-payment-token'], 'server-only-secret');
const payload = JSON.parse(String(sent?.body));
assert.equal(payload.payment.status, 'paid');
assert.equal(payload.order.expectedAmountMinor, 14900);

await assert.rejects(
  () => adapter.provision({ job, payment: { ...payment, status: 'pending' } }),
  /persisted paid payment/,
);
assert.throws(
  () => new HostProvisionerAdapter({
    endpoint: 'http://host.example',
    bridgeToken: 'secret',
    resolveOrder: async () => order,
  }),
  /must use HTTPS/,
);
await assert.rejects(
  () => new HostProvisionerAdapter({
    endpoint: 'https://host.internal',
    bridgeToken: 'secret',
    resolveOrder: async () => ({ ...order, expectedAmountMinor: 1 }),
    fetcher: async () => new Response('{}', { status: 500 }),
  }).provision({ job, payment }),
  /does not match immutable checkout order terms/,
);
await assert.rejects(
  () => new HostProvisionerAdapter({
    endpoint: 'https://host.internal',
    bridgeToken: 'secret',
    resolveOrder: async () => order,
    fetcher: async () => new Response(JSON.stringify({ ok: true, state: 'QUEUED' }), { status: 200 }),
  }).provision({ job, payment }),
  /did not confirm durable PAYMENT_VERIFIED/,
);
console.log('HOST payment fulfillment adapter tests passed');
