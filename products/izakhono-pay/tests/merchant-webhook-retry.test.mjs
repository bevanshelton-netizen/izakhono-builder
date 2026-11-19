import test from 'node:test';
import assert from 'node:assert/strict';
import { claimMerchantWebhookDelivery } from '../src/merchant-webhooks.js';

function fakeDb({ changes = 1, row = null } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async run() { calls.push({ kind: 'run', sql, values }); return { meta: { changes } }; },
            async first() { calls.push({ kind: 'first', sql, values }); return row; }
          };
        }
      };
    }
  };
}

test('delivery claim obtains a unique lease and increments the attempt atomically', async () => {
  const DB = fakeDb({ changes: 1 });
  const result = await claimMerchantWebhookDelivery({ DB }, 'evt_1');
  assert.equal(result.claimed, true);
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
