import { SupabasePaymentWebhookClaimStore } from './payment-webhook-claims-supabase.js';
import { SupabaseRefundOperationStore } from './payment-refund-operations-supabase.js';

function response(status: number, body: unknown = []): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function main(): Promise<void> {
  let webhookRows: Array<{ outcome_fingerprint: string }> = [];
  const webhook = new SupabasePaymentWebhookClaimStore({
    url: 'https://example.supabase.co', serviceRoleKey: 'service-role-test',
    fetcher: async (_input, init) => {
      if (init?.method === 'POST') {
        if (webhookRows.length) return response(409);
        const body = JSON.parse(String(init.body)) as { outcome_fingerprint: string };
        webhookRows = [{ outcome_fingerprint: body.outcome_fingerprint }];
        return response(201);
      }
      return response(200, webhookRows);
    },
  });
  if (await webhook.claim({ provider: 'ikhokha', externalTransactionId: 'tx-1', outcomeFingerprint: 'ok', paymentIntentId: 'pay-1' }) !== 'claimed') throw new Error('webhook first claim failed');
  if (await webhook.claim({ provider: 'ikhokha', externalTransactionId: 'tx-1', outcomeFingerprint: 'ok', paymentIntentId: 'pay-1' }) !== 'duplicate') throw new Error('webhook duplicate was not idempotent');
  if (await webhook.claim({ provider: 'ikhokha', externalTransactionId: 'tx-1', outcomeFingerprint: 'bad', paymentIntentId: 'pay-1' }) !== 'conflict') throw new Error('webhook contradiction was not rejected');

  let refundRows: Array<Record<string, unknown>> = [];
  const refund = new SupabaseRefundOperationStore({
    url: 'https://example.supabase.co', serviceRoleKey: 'service-role-test',
    fetcher: async (input, init) => {
      const url = String(input);
      if (init?.method === 'POST') {
        if (refundRows.length) return response(409);
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        refundRows = [{ ...body, id: 'refundop_1' }];
        return response(201, refundRows);
      }
      if (init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        refundRows = refundRows.map((row) => ({ ...row, ...body }));
        return response(200, refundRows);
      }
      if (url.includes('refund_id=eq.refund-1')) return response(200, refundRows);
      return response(200, []);
    },
  });
  const first = await refund.reserve({ paymentIntentId: 'pay-1', refundId: 'refund-1', amountMinor: 1000, currency: 'ZAR', reason: 'test' });
  if (first.kind !== 'reserved') throw new Error('refund reservation failed');
  await refund.markSucceeded('refund-1', 'provider-ref-1');
  const second = await refund.reserve({ paymentIntentId: 'pay-1', refundId: 'refund-1', amountMinor: 1000, currency: 'ZAR', reason: 'test' });
  if (second.kind !== 'succeeded' || second.operation.providerRefundId !== 'provider-ref-1') throw new Error('refund duplicate was not idempotent');

  console.log('payment-durable-adapters.test.ts: ok');
}

void main();
