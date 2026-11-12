'use strict';
const crypto = require('node:crypto');

function safeEqualText(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyWebhookSignature(rawBody, signature, appSecret) {
  if (!Buffer.isBuffer(rawBody) || !appSecret || typeof signature !== 'string') return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return safeEqualText(signature, expected);
}

function verifyWebhookChallenge(mode, token, expectedToken, challenge) {
  return mode === 'subscribe' && safeEqualText(token, expectedToken) &&
    typeof challenge === 'string' && challenge.length > 0 && challenge.length <= 512;
}

function normaliseWhatsAppWebhook(payload) {
  const events = [];
  for (const entry of (Array.isArray(payload?.entry) ? payload.entry : [])) {
    for (const change of (Array.isArray(entry?.changes) ? entry.changes : [])) {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id || null;
      for (const message of (Array.isArray(value.messages) ? value.messages : [])) {
        if (!message?.id) continue;
        events.push({
          providerEventId: 'message:' + String(message.id),
          eventType: 'message.inbound',
          phoneNumberId,
          payload: { entryId: entry.id || null, field: change.field || null, message, contacts: value.contacts || [] }
        });
      }
      for (const status of (Array.isArray(value.statuses) ? value.statuses : [])) {
        if (!status?.id || !status?.status) continue;
        events.push({
          providerEventId: 'status:' + [status.id, status.status, status.timestamp || ''].join(':'),
          eventType: 'message.status.' + String(status.status).slice(0, 40),
          phoneNumberId,
          payload: { entryId: entry.id || null, field: change.field || null, status }
        });
      }
      if (!Array.isArray(value.messages) && !Array.isArray(value.statuses)) {
        const identity = JSON.stringify({ entry: entry.id || null, field: change.field || null, value });
        events.push({
          providerEventId: 'event:' + crypto.createHash('sha256').update(identity).digest('hex'),
          eventType: String(change.field || 'account.event').slice(0, 120),
          phoneNumberId,
          payload: { entryId: entry.id || null, field: change.field || null, value }
        });
      }
    }
  }
  return events;
}

module.exports = { verifyWebhookSignature, verifyWebhookChallenge, normaliseWhatsAppWebhook };
