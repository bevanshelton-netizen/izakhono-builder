import assert from 'node:assert/strict';
import { signWebhook, verifyWebhook, EventProcessor } from './webhooks.mjs';

const secret = 'sandbox_webhook_secret';
const payload = { payment_id: 'pi_test_001', status: 'succeeded' };
const signed = signWebhook(payload, secret, 1700000000);

assert.equal(verifyWebhook({
  body: signed.body,
  timestamp: signed.timestamp,
  signature: signed.signature,
  secret,
  now: 1700000001
}).valid, true);

assert.equal(verifyWebhook({
  body: signed.body,
  timestamp: signed.timestamp,
  signature: 'bad',
  secret,
  now: 1700000001
}).valid, false);

assert.equal(verifyWebhook({
  body: signed.body,
  timestamp: signed.timestamp,
  signature: signed.signature,
  secret,
  now: 1700001000
}).reason, 'timestamp_outside_tolerance');

const processor = new EventProcessor();
const first = processor.process({ eventId: 'evt_001', type: 'payment.succeeded', payload, signature: signed.signature });
assert.equal(first.status, 'accepted');
const duplicate = processor.process({ eventId: 'evt_001', type: 'payment.succeeded', payload, signature: signed.signature });
assert.equal(duplicate.status, 'ignored');
assert.equal(duplicate.reason, 'duplicate_event');

console.log('IZAKHONO PAY webhook/event QC: GREEN');
