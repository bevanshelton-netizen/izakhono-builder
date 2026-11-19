import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedWebhookUrl,
  claimMerchantWebhookDelivery,
  retryPendingMerchantWebhooks
} from '../src/merchant-webhooks.js';

function fakeDb({ changes = 1, row = null, intents = [] } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() { calls.push({ kind: 'run', sql, values }); return { meta: { changes } }; },
            async first() { calls.push({ kind: 'first', sql, values }); return row; },
            async all() { calls.push({ kind: 'all', sql, values }); return { results: intents }; }
          };
        }
      };
    }
  };
}

test('merchant webhook URLs require an exact allowlisted HTTPS host and default port', () => {
  const env = { MERCHANT_WEBHOOK_ALLOWED_HOSTS: 'hooks.example.com' };
  assert.equal(allowedWebhookUrl(env, 'https://hooks.example.com/payments'), 'https://hooks.example.com/payments');
  assert.equal(allowedWebhookUrl(env, 'http://hooks.example.com/payments'), null);
  assert.equal(allowedWebhookUrl(env, 'https://hooks.example.com:8443/payments'), null);
  assert.equal(allowedWebhookUrl(env, 'https://127.0.0.1/payments'), null);
  assert.equal(allowedWebhookUrl(env, 'https://localhost/payments'), null);
  assert.equal(allowedWebhookUrl(env, 'https://hooks.example.com.attacker.invalid/'), null);
});

test('delivery claim obtains a unique lease and increments the attempt atomically', async () => {
  const DB = fakeDb({ changes: 1, row: { attempt_count: 1 } });
  const result = await claimMerchantWebhookDelivery({ DB }, 'evt_1');
  assert.equal(result.claimed, true);
  assert.equal(result.attemptCount, 1);
  assert.match(result.leaseToken, /^lease_[a-f0-9]{32}$/);
  assert.match(DB.calls[0].sql, /lease_expires_at=datetime\('now','\+30 seconds'\)/);
  assert.match(DB.calls[0].sql, /attempt_count=attempt_count\+1/);
  assert.match(DB.calls[0].sql, /status IN \('pending','failed'\)/);
});

test('a concurrent delivery cannot claim an already leased event', async () => {
  const DB = fakeDb({
    changes: 0,
    row: { event_id: 'evt_1', status: 'pending', lease_token: 'lease_existing' }
  });
  const result = await claimMerchantWebhookDelivery({ DB }, 'evt_1');
  assert.equal(result.claimed, false);
  assert.equal(result.row.lease_token, 'lease_existing');
  assert.equal(DB.calls.length, 2);
});

test('a delivered event is not claimed again', async () => {
  const DB = fakeDb({
    changes: 0,
    row: { event_id: 'evt_1', status: 'delivered', attempt_count: 1 }
  });
  const result = await claimMerchantWebhookDelivery({ DB }, 'evt_1');
  assert.equal(result.claimed, false);
  assert.equal(result.row.status, 'delivered');
});

test('scheduled retry scanner excludes dead-lettered deliveries', async () => {
  const DB = fakeDb({ intents: [
    { id: 'pi_1', app_slug: 'merchant-one', status: 'paid' },
    { id: 'pi_2', app_slug: 'merchant-two', status: 'paid' }
  ] });
  const result = await retryPendingMerchantWebhooks({ DB }, 500);
  assert.deepEqual(result, { attempted: 2, delivered: 0 });
  assert.match(DB.calls[0].sql, /p.status='paid'/);
  assert.match(DB.calls[0].sql, /d.status IN \('pending','failed'\)/);
  assert.match(DB.calls[0].sql, /next_attempt_at<=CURRENT_TIMESTAMP/);
  assert.match(DB.calls[0].sql, /d.dead_lettered_at IS NULL/);
  assert.equal(DB.calls[0].values[0], 100);
});
