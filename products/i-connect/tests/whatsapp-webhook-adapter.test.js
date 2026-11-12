'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifyWebhookSignature, verifyWebhookChallenge, normaliseWhatsAppWebhook } = require('../whatsapp-webhook-adapter');

test('verifies Meta HMAC-SHA256 over the exact raw body', () => {
  const raw = Buffer.from('{"object":"whatsapp_business_account"}');
  const secret = 'test-app-secret';
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(verifyWebhookSignature(raw, signature, secret), true);
  assert.equal(verifyWebhookSignature(raw, signature, 'wrong-secret'), false);
  assert.equal(verifyWebhookSignature(Buffer.from(raw.toString() + ' '), signature, secret), false);
  assert.equal(verifyWebhookSignature(raw, '', secret), false);
});

test('verifies only the expected subscription challenge', () => {
  assert.equal(verifyWebhookChallenge('subscribe', 'expected', 'expected', 'challenge-123'), true);
  assert.equal(verifyWebhookChallenge('subscribe', 'wrong', 'expected', 'challenge-123'), false);
  assert.equal(verifyWebhookChallenge('unsubscribe', 'expected', 'expected', 'challenge-123'), false);
});

test('normalises inbound messages and delivery status events', () => {
  const events = normaliseWhatsAppWebhook({
    object: 'whatsapp_business_account',
    entry: [{ id: 'waba-1', changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: 'phone-1' },
      contacts: [{ wa_id: '27820000000' }],
      messages: [{ id: 'wamid-1', from: '27820000000', type: 'text', text: { body: 'Hello' } }],
      statuses: [{ id: 'wamid-2', status: 'delivered', timestamp: '123' }]
    } }] }]
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].eventType, 'message.inbound');
  assert.equal(events[0].phoneNumberId, 'phone-1');
  assert.equal(events[1].eventType, 'message.status.delivered');
  assert.ok(events.every(event => event.providerEventId));
});

test('ignores malformed message/status objects without provider ids', () => {
  const events = normaliseWhatsAppWebhook({ entry: [{ changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: 'phone-1' }, messages: [{ from: '2782' }], statuses: [{ status: 'read' }]
  } }] }] });
  assert.equal(events.length, 0);
});

test('creates deterministic ids for non-message account events', () => {
  const payload = { entry: [{ id: 'waba-1', changes: [{ field: 'account_update', value: { status: 'active' } }] }] };
  const a = normaliseWhatsAppWebhook(payload);
  const b = normaliseWhatsAppWebhook(payload);
  assert.equal(a[0].providerEventId, b[0].providerEventId);
  assert.equal(a[0].eventType, 'account_update');
});
