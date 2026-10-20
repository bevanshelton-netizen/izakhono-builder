export interface WebhookVerificationInput {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  nowMs?: number;
  toleranceSeconds?: number;
}

export interface WebhookVerificationResult {
  ok: boolean;
  reason?:
    | 'missing_signature'
    | 'missing_timestamp'
    | 'invalid_timestamp'
    | 'stale_request'
    | 'invalid_signature';
}

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

/**
 * Provider-neutral webhook authentication.
 * The signed payload is: `${timestamp}.${rawBody}`.
 * Gateways may prefix the signature with `sha256=`; both forms are accepted.
 */
export async function verifyVoiceWebhook(
  secret: string,
  input: WebhookVerificationInput,
): Promise<WebhookVerificationResult> {
  if (!input.signature) return { ok: false, reason: 'missing_signature' };
  if (!input.timestamp) return { ok: false, reason: 'missing_timestamp' };

  const timestampMs = Number(input.timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return { ok: false, reason: 'invalid_timestamp' };

  const nowMs = input.nowMs ?? Date.now();
  const toleranceMs = (input.toleranceSeconds ?? 300) * 1000;
  if (Math.abs(nowMs - timestampMs) > toleranceMs) return { ok: false, reason: 'stale_request' };

  const expected = await hmacHex(secret, `${input.timestamp}.${input.rawBody}`);
  const supplied = input.signature.replace(/^sha256=/i, '').toLowerCase();

  return timingSafeEqual(supplied, expected)
    ? { ok: true }
    : { ok: false, reason: 'invalid_signature' };
}
