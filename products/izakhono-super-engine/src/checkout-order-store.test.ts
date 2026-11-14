import assert from 'node:assert/strict';
import { SupabaseCheckoutOrderStore, type CreateCheckoutOrderInput } from './checkout-order-store.js';

const order: CreateCheckoutOrderInput = {
  orderId: 'ord_001', paymentIntentId: 'pay_001', externalTransactionId: 'txn_001',
  customerId: 'cus_001', domain: 'example.co.za', expectedAmountMinor: 14900,
  currency: 'ZAR', idempotencyKey: 'idem_001', productId: 'host-starter',
  createdAt: '2026-11-14T08:00:00.000Z',
};
const row = {
  order_id: order.orderId, payment_intent_id: order.paymentIntentId,
  external_transaction_id: order.externalTransactionId, customer_id: order.customerId,
  domain: order.domain, expected_amount_minor: order.expectedAmountMinor,
  currency: order.currency, idempotency_key: order.idempotencyKey,
  product_id: order.productId, created_at: order.createdAt,
};

let requests: Array<{ url: string; init?: RequestInit }> = [];
const inserted = new SupabaseCheckoutOrderStore({
  url: 'https://db.example', serviceRoleKey: 'server-secret',
  fetcher: async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify([row]), { status: 201 });
  },
});
const created = await inserted.createOrGet(order);
assert.equal(created.paymentIntentId, order.paymentIntentId);
assert.equal(requests[0].init?.method, 'POST');
assert.match(String((requests[0].init?.headers as Headers).get('Prefer')), /ignore-duplicates/);

requests = [];
const duplicate = new SupabaseCheckoutOrderStore({
  url: 'https://db.example', serviceRoleKey: 'server-secret',
  fetcher: async (url) => {
    requests.push({ url: String(url) });
    if (requests.length === 1) return new Response('[]', { status: 201 });
    return new Response(JSON.stringify([row]), { status: 200 });
  },
});
assert.equal((await duplicate.createOrGet(order)).orderId, order.orderId);
assert.equal(requests.length, 2);

const conflict = new SupabaseCheckoutOrderStore({
  url: 'https://db.example', serviceRoleKey: 'server-secret',
  fetcher: async (url) => String(url).includes('order_id=') ?
    new Response('[]', { status: 201 }) :
    new Response(JSON.stringify([{ ...row, expected_amount_minor: 1 }]), { status: 200 }),
});
await assert.rejects(() => conflict.createOrGet(order), /Conflicting reuse/);

const lookup = new SupabaseCheckoutOrderStore({
  url: 'https://db.example', serviceRoleKey: 'server-secret',
  fetcher: async () => new Response(JSON.stringify([row]), { status: 200 }),
});
assert.equal((await lookup.getByPaymentIntentId('pay_001'))?.domain, 'example.co.za');

await assert.rejects(() => inserted.createOrGet({ ...order, expectedAmountMinor: 0 }), /positive integer/);
await assert.rejects(() => inserted.createOrGet({ ...order, domain: 'https://example.co.za' }), /normalized public DNS/);
console.log('Immutable checkout order store tests passed');
