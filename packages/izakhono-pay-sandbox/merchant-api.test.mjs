import assert from 'node:assert/strict';
import { registerMerchant, createPayment, getSandboxState } from './merchant-api.mjs';

const account = registerMerchant('merchant_demo_001');
assert.equal(account.merchant.environment, 'sandbox');
assert.match(account.api_key, /^sk_test_/);

const first = createPayment({
  apiKey: account.api_key,
  amountMinor: 2500,
  currency: 'ZAR',
  scenario: 'approved',
  idempotencyKey: 'order-001'
});
assert.equal(first.status, 'succeeded');
assert.equal(first.funds_movement, 'none');
assert.equal(first.merchant_id, 'merchant_demo_001');

const replay = createPayment({
  apiKey: account.api_key,
  amountMinor: 9999,
  currency: 'ZAR',
  scenario: 'declined',
  idempotencyKey: 'order-001'
});
assert.equal(replay.id, first.id);
assert.equal(replay.idempotent_replay, true);
assert.equal(replay.status, 'succeeded');

assert.throws(() => createPayment({
  apiKey: 'sk_test_invalid',
  amountMinor: 100,
  idempotencyKey: 'bad'
}), /Invalid sandbox API key/);

const state = getSandboxState();
assert.equal(state.funds_movement, 'none');
assert.equal(state.merchant_count, 1);
assert.equal(state.idempotency_records, 1);

console.log('IZAKHONO PAY merchant API QC: GREEN');
