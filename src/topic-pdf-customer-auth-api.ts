import {
  consumeEmailVerificationToken,
  createCustomerSession,
  createEmailVerificationToken,
  hashCustomerPassword,
  resolveCustomerSession,
  revokeCustomerSession,
  verifyCustomerPassword,
} from './customer-auth';

const COOKIE = '__Host-topic_pdf_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

interface AuthEnv {
  DB: any;
  TOPIC_PDF_CUSTOMER_AUTH_ENABLED?: string;
  TOPIC_PDF_EMAIL_URL?: string;
  TOPIC_PDF_EMAIL_KEY?: string;
  TOPIC_PDF_PUBLIC_BASE_URL?: string;
  TOPIC_PDF_AUTH_RATE_LIMIT_SECRET?: string;
}

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const result = new Headers(headers);
  result.set('content-type', 'application/json; charset=utf-8');
  result.set('cache-control', 'no-store');
  result.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(data), { status, headers: result });
}

export function getTopicPdfSessionToken(req: Request): string {
  const authorization = req.headers.get('authorization') || '';
  const bearer = authorization.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if (bearer) return bearer;
  const cookie = req.headers.get('cookie') || '';
  const entry = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(COOKIE + '='));
  const value = entry?.slice(COOKIE.length + 1) || '';
  return /^[a-f0-9]{64}$/i.test(value) ? value : '';
}

function cookie(token: string, maxAge = SESSION_MAX_AGE): string {
  return COOKIE + '=' + token + '; Path=/; Max-Age=' + maxAge + '; Secure; HttpOnly; SameSite=Strict';
}

function originAllowed(req: Request, url: URL): boolean {
  const origin = req.headers.get('origin');
  return !origin || origin === url.origin;
}

async function readJson(req: Request): Promise<any> {
  const length = Number(req.headers.get('content-length') || 0);
  if (length > 12_000) throw new Error('Request body is too large.');
  const raw = await req.text();
  if (raw.length > 12_000) throw new Error('Request body is too large.');
  return JSON.parse(raw);
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function allowedAttempt(env: AuthEnv, scope: string, value: string, limit: number, windowMs: number): Promise<boolean> {
  const secret = env.TOPIC_PDF_AUTH_RATE_LIMIT_SECRET;
  if (!secret) return false;
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = new Date(now.getTime() - windowMs).toISOString();
  const bucket = await hmac(secret, scope + ':' + value);
  const row = await env.DB.prepare(
    `INSERT INTO topic_pdf_auth_rate_limits(bucket_key,window_started_at,attempts,updated_at)
     VALUES(?,?,1,?)
     ON CONFLICT(bucket_key) DO UPDATE SET
       attempts=CASE WHEN window_started_at<=? THEN 1 ELSE attempts+1 END,
       window_started_at=CASE WHEN window_started_at<=? THEN excluded.window_started_at ELSE window_started_at END,
       updated_at=excluded.updated_at
     RETURNING attempts`,
  ).bind(bucket, nowIso, nowIso, cutoff, cutoff).first();
  return Number(row?.attempts || 0) <= limit;
}

function authReady(env: AuthEnv): boolean {
  return env.TOPIC_PDF_CUSTOMER_AUTH_ENABLED === 'true' &&
    Boolean(env.TOPIC_PDF_EMAIL_URL && env.TOPIC_PDF_EMAIL_KEY && env.TOPIC_PDF_PUBLIC_BASE_URL && env.TOPIC_PDF_AUTH_RATE_LIMIT_SECRET);
}

async function sendVerificationEmail(env: AuthEnv, email: string, displayName: string, token: string): Promise<void> {
  const base = new URL(String(env.TOPIC_PDF_PUBLIC_BASE_URL));
  if (base.protocol !== 'https:') throw new Error('Public storefront URL must use HTTPS.');
  const link = base.toString().replace(/\/$/, '') + '/topic-guides/#verify=' + encodeURIComponent(token);
  const response = await fetch(String(env.TOPIC_PDF_EMAIL_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + env.TOPIC_PDF_EMAIL_KEY,
      'x-izakhono-message-class': 'transactional',
    },
    body: JSON.stringify({
      to: email,
      template: 'topic-pdf-email-verification',
      subject: 'Verify your Topic Guides account',
      displayName,
      verificationUrl: link,
      expiresInMinutes: 30,
      doNotLogSecrets: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error('Transactional email adapter returned HTTP ' + response.status + ': ' + text.slice(0, 240));
}

async function register(req: Request, env: AuthEnv): Promise<Response> {
  let body: any;
  try { body = await readJson(req); } catch (error) { return json({ ok: false, error: String(error) }, 400); }
  const email = String(body?.email || '').trim().toLowerCase().slice(0, 200);
  const displayName = String(body?.displayName || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const organization = String(body?.organization || '').trim().slice(0, 180);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !displayName || password.length < 12 || password.length > 128) {
    return json({ ok: false, error: 'Enter a valid email, name and password of 12-128 characters.' }, 400);
  }
  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await allowedAttempt(env, 'register-ip', ip, 3, 60 * 60_000)) ||
      !(await allowedAttempt(env, 'register-email', email, 3, 60 * 60_000))) {
    return json({ ok: false, error: 'Registration limit reached. Try again later.' }, 429);
  }

  const id = 'cust_' + crypto.randomUUID().replaceAll('-', '');
  const passwordHash = await hashCustomerPassword(password);
  try {
    await env.DB.prepare(
      "INSERT INTO builder_customers(id,email,display_name,organization,password_hash,password_scheme,status,created_at,updated_at) VALUES(?,?,?,?,?,'pbkdf2-sha256-v1','pending_verification',?,?)",
    ).bind(id, email, displayName, organization, passwordHash, new Date().toISOString(), new Date().toISOString()).run();
  } catch {
    // Do not reveal whether an email address already has an account.
    return json({ ok: true, accepted: true, message: 'If the account can be created, a verification email will arrive shortly.' }, 202);
  }

  try {
    const issued = await createEmailVerificationToken(env.DB, id);
    await sendVerificationEmail(env, email, displayName, issued.token);
    await env.DB.prepare('INSERT INTO builder_customer_events(id,customer_id,event_type,detail,created_at) VALUES(?,?,?,?,?)')
      .bind('bce_' + crypto.randomUUID().replaceAll('-', ''), id, 'customer.email_verification_sent', 'Transactional verification email requested.', new Date().toISOString()).run();
  } catch {
    await env.DB.prepare('DELETE FROM builder_customers WHERE id=?').bind(id).run();
    return json({ ok: false, error: 'Account verification email could not be sent. Please try again later.' }, 503);
  }
  return json({ ok: true, accepted: true, message: 'Check your email for a verification link. It expires after 30 minutes.' }, 202);
}

async function verify(req: Request, env: AuthEnv): Promise<Response> {
  let body: any;
  try { body = await readJson(req); } catch (error) { return json({ ok: false, error: String(error) }, 400); }
  const token = String(body?.token || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ ok: false, error: 'Verification token is invalid or expired.' }, 400);
  const customerId = await consumeEmailVerificationToken(env.DB, token);
  if (!customerId) return json({ ok: false, error: 'Verification token is invalid, expired or already used.' }, 400);
  const session = await createCustomerSession(env.DB, customerId);
  const headers = new Headers({ 'set-cookie': cookie(session.token), 'referrer-policy': 'no-referrer' });
  return json({ ok: true, verified: true, expiresAt: session.expiresAt }, 200, headers);
}

async function login(req: Request, env: AuthEnv): Promise<Response> {
  let body: any;
  try { body = await readJson(req); } catch (error) { return json({ ok: false, error: String(error) }, 400); }
  const email = String(body?.email || '').trim().toLowerCase().slice(0, 200);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password || password.length > 128) return json({ ok: false, error: 'Email or password is incorrect.' }, 401);
  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  if (!(await allowedAttempt(env, 'login-ip', ip, 10, 15 * 60_000)) ||
      !(await allowedAttempt(env, 'login-email', email, 10, 15 * 60_000))) {
    return json({ ok: false, error: 'Too many sign-in attempts. Try again later.' }, 429);
  }
  const customer = await env.DB.prepare(
    'SELECT id,email,display_name,organization,password_hash,password_scheme,status FROM builder_customers WHERE email=? LIMIT 1',
  ).bind(email).first<any>();
  if (!customer || customer.password_scheme !== 'pbkdf2-sha256-v1' || !(await verifyCustomerPassword(password, customer.password_hash))) {
    return json({ ok: false, error: 'Email or password is incorrect.' }, 401);
  }
  if (customer.status !== 'active') return json({ ok: false, error: 'Verify your email address before signing in.' }, 403);
  const session = await createCustomerSession(env.DB, customer.id);
  const headers = new Headers({ 'set-cookie': cookie(session.token) });
  return json({ ok: true, customer: { id: customer.id, email: customer.email, displayName: customer.display_name, organization: customer.organization }, expiresAt: session.expiresAt }, 200, headers);
}

export async function topicPdfCustomerAuthRoute(req: Request, env: AuthEnv, url: URL): Promise<Response | null> {
  const route = new Set([
    '/api/topic-pdfs/customer/register',
    '/api/topic-pdfs/customer/verify',
    '/api/topic-pdfs/customer/login',
    '/api/topic-pdfs/customer/logout',
    '/api/topic-pdfs/customer/session',
  ]);
  if (!route.has(url.pathname)) return null;
  if (!authReady(env)) return json({ ok: false, error: 'Customer authentication is not enabled or its transactional email/rate-limit configuration is incomplete.' }, 503);
  if (!originAllowed(req, url)) return json({ ok: false, error: 'Cross-origin request rejected.' }, 403);

  if (req.method === 'POST' && url.pathname === '/api/topic-pdfs/customer/register') return register(req, env);
  if (req.method === 'POST' && url.pathname === '/api/topic-pdfs/customer/verify') return verify(req, env);
  if (req.method === 'POST' && url.pathname === '/api/topic-pdfs/customer/login') return login(req, env);

  if (req.method === 'POST' && url.pathname === '/api/topic-pdfs/customer/logout') {
    const token = getTopicPdfSessionToken(req);
    if (token) await revokeCustomerSession(env.DB, token);
    return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
  }
  if (req.method === 'GET' && url.pathname === '/api/topic-pdfs/customer/session') {
    const token = getTopicPdfSessionToken(req);
    const customer = token ? await resolveCustomerSession(env.DB, token) : null;
    if (!customer) return json({ ok: false, error: 'Sign in required.' }, 401);
    return json({ ok: true, customer: { id: customer.id, email: customer.email, displayName: customer.display_name, organization: customer.organization } });
  }
  return json({ ok: false, error: 'Method not allowed.' }, 405);
}
