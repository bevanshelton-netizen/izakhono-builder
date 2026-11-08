import { resolveCustomerSession, type CustomerAuthDB, type CustomerIdentity } from '../../../src/customer-auth';

export interface RateLimitDB extends CustomerAuthDB {}

export type MobileApiEnvironment = {
  DB: RateLimitDB;
  ALLOWED_ORIGINS: string;
};

export type GuardResult =
  | { ok: true; identity: CustomerIdentity; requestId: string }
  | { ok: false; response: Response };

const MAX_BODY_BYTES = 64 * 1024;
const RATE_WINDOW_SECONDS = 60;
const RATE_LIMIT = 30;

function jsonError(status: number, code: string, requestId: string, headers: HeadersInit = {}) {
  return new Response(JSON.stringify({ error: { code, requestId } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function requestToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
    if (!match) return null;
    return match[1];
  }
  const cookie = request.headers.get('cookie') || '';
  const match = /(?:^|;\s*)izakhono_session=([a-f0-9]{64})(?:;|$)/i.exec(cookie);
  return match?.[1] || null;
}

function originAllowed(request: Request, allowedOrigins: string): boolean {
  const origin = request.headers.get('origin');
  // Native clients may omit Origin. Browser cookie-authenticated requests may not.
  if (!origin) return !request.headers.get('cookie');
  const allowed = allowedOrigins.split(',').map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin);
}

async function consumeRateLimit(db: RateLimitDB, key: string, now: Date): Promise<boolean> {
  const windowStart = Math.floor(now.getTime() / (RATE_WINDOW_SECONDS * 1000)) * RATE_WINDOW_SECONDS;
  const row = await db.prepare(
    `INSERT INTO mobile_api_rate_limits(rate_key,window_start,request_count,updated_at)
     VALUES(?,?,1,?)
     ON CONFLICT(rate_key) DO UPDATE SET
       request_count=CASE WHEN mobile_api_rate_limits.window_start=? THEN mobile_api_rate_limits.request_count+1 ELSE 1 END,
       window_start=excluded.window_start,
       updated_at=excluded.updated_at
     RETURNING request_count`,
  ).bind(key, windowStart, now.toISOString(), windowStart).first<{ request_count: number }>();
  return Boolean(row && row.request_count <= RATE_LIMIT);
}

/**
 * Shared server-side gate. Call before reading or writing tenant data.
 * The organisation string on the existing identity is not treated as a tenant ID:
 * callers must resolve explicit membership before accessing organisation records.
 */
export async function guardMobileApi(
  request: Request,
  env: MobileApiEnvironment,
  options: { now?: Date; maxBodyBytes?: number } = {},
): Promise<GuardResult> {
  const requestId = request.headers.get('x-request-id')?.slice(0, 80) || crypto.randomUUID();
  const now = options.now || new Date();
  if (!originAllowed(request, env.ALLOWED_ORIGINS || '')) {
    return { ok: false, response: jsonError(403, 'ORIGIN_NOT_ALLOWED', requestId) };
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > (options.maxBodyBytes ?? MAX_BODY_BYTES)) {
    return { ok: false, response: jsonError(413, 'PAYLOAD_TOO_LARGE', requestId) };
  }
  const token = requestToken(request);
  if (!token) return { ok: false, response: jsonError(401, 'UNAUTHENTICATED', requestId) };

  let identity: CustomerIdentity | null;
  try { identity = await resolveCustomerSession(env.DB, token, now); }
  catch { return { ok: false, response: jsonError(503, 'IDENTITY_UNAVAILABLE', requestId) }; }
  if (!identity) return { ok: false, response: jsonError(401, 'UNAUTHENTICATED', requestId) };

  try {
    const allowed = await consumeRateLimit(env.DB, `mobile:${identity.id}`, now);
    if (!allowed) return { ok: false, response: jsonError(429, 'RATE_LIMITED', requestId, { 'retry-after': String(RATE_WINDOW_SECONDS) }) };
  } catch {
    // Fail closed: a rate-limit storage outage must not silently disable request limits.
    return { ok: false, response: jsonError(503, 'RATE_LIMIT_UNAVAILABLE', requestId) };
  }
  return { ok: true, identity, requestId };
}

export function validateJsonBodySize(request: Request, maxBytes = MAX_BODY_BYTES): Response | null {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) return new Response(null, { status: 413 });
  return null;
}
