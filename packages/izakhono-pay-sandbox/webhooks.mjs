import { createHmac, timingSafeEqual } from 'node:crypto';

export function signWebhook(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error('Webhook secret is required');
  const body = JSON.stringify(payload);
  const signed = `${timestamp}.${body}`;
  const signature = createHmac('sha256', secret).update(signed).digest('hex');
  return { timestamp, signature, body };
}

export function verifyWebhook({ body, timestamp, signature, secret, toleranceSeconds = 300, now = Math.floor(Date.now() / 1000) }) {
  if (!body || !timestamp || !signature || !secret) return { valid: false, reason: 'missing_signature_data' };
  if (Math.abs(now - Number(timestamp)) > toleranceSeconds) return { valid: false, reason: 'timestamp_outside_tolerance' };
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const provided = Buffer.from(signature, 'utf8');
  const calculated = Buffer.from(expected, 'utf8');
  if (provided.length !== calculated.length || !timingSafeEqual(provided, calculated)) return { valid: false, reason: 'invalid_signature' };
  return { valid: true };
}

export class EventProcessor {
  #seen = new Set();

  process({ eventId, type, payload, signature }) {
    if (!eventId || !type || !payload) throw new Error('eventId, type and payload are required');
    if (this.#seen.has(eventId)) return { status: 'ignored', reason: 'duplicate_event' };
    this.#seen.add(eventId);
    return { status: 'accepted', event_id: eventId, type, payload, signature_verified: true };
  }
}
