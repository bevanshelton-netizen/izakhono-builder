import { strict as assert } from 'node:assert';
import { SupabasePaymentStore } from './payment-supabase.js';
import type { PaymentIntent } from './payment-core.js';

const intent: PaymentIntent = {
  id: 'pay_test_1',
  externalTransactionId: 'order_test_1',
  amountMinor: 14900,
  currency: 'ZAR',
  description: 'Test purchase',
  status: 'pending',
  provider: 'ikhokha',
  providerPaymentId: 'plink_test_1',
  createdAt: '2026-10-30T20:00:00.000Z',
  updatedAt: '2026-10-30T20:00:00.000Z',
};

const requests: Array<{ url: string; init?: RequestInit }> = [];
const store = new SupabasePaymentStore({
  url: 'https://example.supabase.co',
  serviceRoleKey: 'server-only-test-key',
  fetcher: async (input, init) => {
    requests.push({ url: String(input), init });
    const method = init?.method ?? 'GET';
    if (method === 'POST') return new Response(null, { status: 201 });
    if (method === 'GET') return Response.json([{
      id: intent.id,
      external_transaction_id: intent.externalTransactionId,
      amount_minor: intent.amountMinor,
      currency: intent.currency,
      description: intent.description,
      status: intent.status,
      provider: intent.provider,
      provider_payment_id: intent.providerPaymentId,
      created_at: intent.createdAt,
      updated_at: intent.updatedAt,
    }]);
    return Response.json([{ ...intent, status: 'paid', updated_at: '2026-10-30T20:01:00.000Z' }]);
  },
});

await store.save(intent);
assert.equal(requests.length, 1);
assert.equal(new Headers(requests[0].init?.headers).get('Authorization'), 'Bearer server-only-test-key');
assert.match(String(requests[0].init?.body), /order_test_1/);

const found = await store.getByExternalTransactionId(intent.externalTransactionId);
assert.deepEqual(found, intent);

const updated = await store.update(intent.id, { status: 'paid' });
assert.equal(updated.status, 'paid');
assert.equal(updated.id, intent.id);

console.log('payment-supabase tests passed');
