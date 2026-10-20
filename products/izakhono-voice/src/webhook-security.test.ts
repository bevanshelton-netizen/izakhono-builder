import { verifyVoiceWebhook } from './webhook-security';

const secret = 'test-secret';
const body = '{"event":"call.started","call_id":"call-001"}';
const timestamp = '1761000000';

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const signature = await sign(`${timestamp}.${body}`);

const accepted = await verifyVoiceWebhook(secret, {
  rawBody: body,
  signature,
  timestamp,
  nowMs: 1761000000 * 1000,
});
if (!accepted.ok) throw new Error(`expected webhook to verify: ${accepted.reason}`);

const rejected = await verifyVoiceWebhook(secret, {
  rawBody: body,
  signature: 'sha256=bad',
  timestamp,
  nowMs: 1761000000 * 1000,
});
if (rejected.ok || rejected.reason !== 'invalid_signature') throw new Error('expected invalid signature rejection');

const stale = await verifyVoiceWebhook(secret, {
  rawBody: body,
  signature,
  timestamp,
  nowMs: 1761003601 * 1000,
});
if (stale.ok || stale.reason !== 'stale_request') throw new Error('expected stale request rejection');

console.log('IZAKHONO VOICE webhook security tests passed');
