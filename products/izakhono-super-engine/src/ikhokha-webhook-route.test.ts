import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { createIKhokhaWebhookRoute } from './ikhokha-webhook-route.js';
import type { PaymentIntent } from './payment-core.js';

const payment: PaymentIntent = {
  id: 'pay_test', externalTransactionId: 'order_test', amountMinor: 1000, currency: 'ZAR',
  status: 'paid', provider: 'ikhokha', providerPaymentId: 'paylink_test',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
const received: Array<{ raw: string; path: string; signature: string }> = [];
const paid: PaymentIntent[] = [];
const route = createIKhokhaWebhookRoute({
  callbackPath: '/api/payments/ikhokha/callback',
  signatureHeader: 'x-ikhokha-signature',
  guard: {
    async process(raw, path, signature) {
      received.push({ raw, path, signature });
      if (signature !== 'valid-signature') throw new Error('Invalid payment webhook signature');
      return payment;
    },
  },
  async onPaid(value) { paid.push(value); },
});
const server: Server = createServer(async (req, res) => {
  if (await route(req, res)) return;
  res.statusCode = 404;
  res.end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Test server did not bind TCP');
const base = `http://127.0.0.1:${address.port}`;
try {
  const raw = '{ "status" : "SUCCESS", "responseCode" : "00" }';
  const ok = await fetch(`${base}/api/payments/ikhokha/callback`, {
    method: 'POST', headers: { 'x-ikhokha-signature': 'valid-signature', 'content-type': 'application/json' }, body: raw,
  });
  assert.equal(ok.status, 200);
  assert.equal(received[0].raw, raw, 'signature verifier receives exact raw body');
  assert.equal(received[0].path, '/api/payments/ikhokha/callback');
  assert.equal(paid.length, 1);

  const bad = await fetch(`${base}/api/payments/ikhokha/callback`, {
    method: 'POST', headers: { 'x-ikhokha-signature': 'wrong' }, body: raw,
  });
  assert.equal(bad.status, 401);
  assert.equal(paid.length, 1);

  const missing = await fetch(`${base}/api/payments/ikhokha/callback`, { method: 'POST', body: raw });
  assert.equal(missing.status, 401);

  const method = await fetch(`${base}/api/payments/ikhokha/callback`, { method: 'GET' });
  assert.equal(method.status, 405);

  const tooLargeRoute = createIKhokhaWebhookRoute({
    callbackPath: '/limited', signatureHeader: 'x-ikhokha-signature',
    guard: { async process() { throw new Error('must not be called'); } },
    async onPaid() {}, maxBodyBytes: 4,
  });
  const limitedServer = createServer(async (req, res) => { if (!await tooLargeRoute(req, res)) res.end(); });
  limitedServer.listen(0, '127.0.0.1');
  await once(limitedServer, 'listening');
  const limitedAddress = limitedServer.address();
  if (!limitedAddress || typeof limitedAddress === 'string') throw new Error('Limited server did not bind');
  try {
    const large = await fetch(`http://127.0.0.1:${limitedAddress.port}/limited`, {
      method: 'POST', headers: { 'x-ikhokha-signature': 'valid' }, body: '123456789',
    });
    assert.equal(large.status, 413);
  } finally { limitedServer.close(); await once(limitedServer, 'close'); }
} finally { server.close(); await once(server, 'close'); }
console.log('iKhokha raw-body webhook route tests passed');
