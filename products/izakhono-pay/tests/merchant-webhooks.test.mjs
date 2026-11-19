import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchMerchantPaymentPaid } from '../src/merchant-webhooks.js';

function createEnv() {
  const deliveries = new Map();
  const merchant = {
    slug: 'merchant-a',
    webhook_url: 'https://merchant.example.test/payments',
    webhook_secret_env: 'MERCHANT_A_WEBHOOK_SECRET',
    status: 'active'
  };
  const env = {
    MERCHANT_WEBHOOK_ALLOWED_HOSTS: 'merchant.example.test',
    MERCHANT_A_WEBHOOK_SECRET: 'test-webhook-secret',
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes('FROM merchant_apps')) return merchant;
                if (sql.includes('FROM merchant_webhook_deliveries')) return deliveries.get(args[0]) || null;
                throw new Error(`Unexpected first query: ${sql}`);
              },
              async run() {
                if (sql.startsWith('INSERT INTO merchant_webhook_deliveries')) {
                  const [, eventId, merchantSlug, intentId, webhookUrl, status, error, leaseToken] = args;
                  if (deliveries.has(eventId)) throw new Error('UNIQUE constraint failed: merchant_webhook_deliveries.event_id');
                  deliveries.set(eventId, { event_id: eventId, merchant_slug: merchantSlug, intent_id: intentId, webhook_url: webhookUrl, status, last_error: error, attempt_count: 0, lease_token: leaseToken, lease_expires_at: leaseToken ? '2999-01-01 00:00:00' : null });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("SET status='pending'")) {
                  const row = deliveries.get(args[1]);
                  if (!row || !(row.status === 'failed' || (row.status === 'pending' && row.lease_expires_at <= '2026-11-19 00:00:00'))) return { meta: { changes: 0 } };
                  row.status = 'pending';
                  row.lease_token = args[0];
                  row.lease_expires_at = '2999-01-01 00:00:00';
                  row.last_error = null;
                  row.last_http_status = null;
                  return { meta: { changes: 1 } };
                }
                if (sql.startsWith('UPDATE merchant_webhook_deliveries')) {
                  const [status, httpStatus, error, , eventId, leaseToken] = args;
                  const row = deliveries.get(eventId);
                  if (!row || row.lease_token !== leaseToken) return { meta: { changes: 0 } };
                  row.status = status;
                  row.attempt_count += 1;
                  row.last_http_status = httpStatus;
                  row.last_error = error;
                  row.lease_token = null;
                  row.lease_expires_at = null;
                  return { meta: { changes: 1 } };
                }
                throw new Error(`Unexpected run query: ${sql}`);
              }
            };
          }
        };
      }
    }
  };
  return { env, deliveries };
}

const intent = {
  id: 'pi_replay_1',
  app_slug: 'merchant-a',
  reference: 'IZP-REPLAY-1',
  amount_minor: 12500,
  currency: 'ZAR',
  routed_provider: 'paystack',
  provider_reference: 'provider-tx-1',
  metadata_json: '{}'
};

test('failed merchant payment webhook delivery is retried on verified payment replay', async () => {
  const { env, deliveries } = createEnv();
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response('', { status: attempts === 1 ? 503 : 200 });
  };
  try {
    const first = await dispatchMerchantPaymentPaid(env, intent);
    assert.equal(first.delivered, false);
    assert.equal(first.reason, 'merchant_rejected');

    const second = await dispatchMerchantPaymentPaid(env, intent);
    assert.equal(second.delivered, true);
    assert.equal(attempts, 2);
    const row = [...deliveries.values()][0];
    assert.equal(row.status, 'delivered');
    assert.equal(row.attempt_count, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a delivered merchant payment webhook is not sent again on duplicate replay', async () => {
  const { env } = createEnv();
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response('', { status: 200 });
  };
  try {
    const first = await dispatchMerchantPaymentPaid(env, intent);
    const duplicate = await dispatchMerchantPaymentPaid(env, intent);
    assert.equal(first.delivered, true);
    assert.equal(duplicate.delivered, false);
    assert.equal(duplicate.reason, 'duplicate');
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
