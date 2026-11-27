import { resolveCustomerSession } from './customer-auth';
import { planTopicPdfGeneration, validateTopicPdfRequest } from '../products/topic-pdfs/src/generation-core';

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = any>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface TopicPdfEnv {
  DB: { prepare(sql: string): Statement };
  TOPIC_PDF_REQUESTS_ENABLED?: string;
}

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

function bearer(req: Request): string {
  const value = req.headers.get('authorization') || '';
  const match = value.match(/^Bearer ([a-f0-9]{64})$/i);
  return match?.[1] || '';
}

async function fingerprint(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function topicPdfRequestRoute(req: Request, env: TopicPdfEnv, url: URL): Promise<Response | null> {
  const isCollection = url.pathname === '/api/topic-pdfs/requests';
  const item = url.pathname.match(/^\/api\/topic-pdfs\/requests\/([a-zA-Z0-9_-]{8,80})$/);
  if (!isCollection && !item) return null;
  if (env.TOPIC_PDF_REQUESTS_ENABLED !== 'true') {
    return response({ ok: false, error: 'Topic PDF customer requests are not enabled yet.' }, 503);
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return response({ ok: false, error: 'Method not allowed.' }, 405);
  }
  if (req.method === 'POST' && !isCollection) return response({ ok: false, error: 'Not found.' }, 404);
  if (req.method === 'GET' && isCollection) return response({ ok: false, error: 'Method not allowed.' }, 405);

  const origin = req.headers.get('origin');
  if (origin && origin !== url.origin) return response({ ok: false, error: 'Cross-origin request rejected.' }, 403);

  const token = bearer(req);
  if (!token) return response({ ok: false, error: 'A valid customer session is required.' }, 401);
  const customer = await resolveCustomerSession(env.DB as any, token);
  if (!customer) return response({ ok: false, error: 'Customer session is invalid or expired.' }, 401);

  if (req.method === 'GET' && item) {
    const row = await env.DB.prepare(
      'SELECT id,status,risk_level,created_at,updated_at FROM topic_pdf_generation_jobs WHERE id=? AND requested_by=? LIMIT 1',
    ).bind(item[1], customer.id).first<any>();
    if (!row) return response({ ok: false, error: 'Request not found.' }, 404);
    return response({ ok: true, request: row });
  }

  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (declaredLength > 12_000) return response({ ok: false, error: 'Request body is too large.' }, 413);
  let input: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 12_000) return response({ ok: false, error: 'Request body is too large.' }, 413);
    input = JSON.parse(raw);
  } catch {
    return response({ ok: false, error: 'A valid JSON request is required.' }, 400);
  }

  const validated = validateTopicPdfRequest(input);
  if (!validated.ok) return response({ ok: false, errors: validated.errors }, 400);
  const plan = planTopicPdfGeneration(validated.request);
  const canonical = JSON.stringify({ customerId: customer.id, request: validated.request });
  const requestFingerprint = await fingerprint(canonical);
  const idempotencyKey = (req.headers.get('idempotency-key') || '').trim().slice(0, 120);

  if (idempotencyKey) {
    const existing = await env.DB.prepare(
      'SELECT id,status,risk_level,created_at FROM topic_pdf_generation_jobs WHERE requested_by=? AND request_fingerprint=? LIMIT 1',
    ).bind(customer.id, requestFingerprint).first<any>();
    if (existing) return response({ ok: true, duplicate: true, request: existing }, 200);
  }

  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM topic_pdf_generation_jobs WHERE requested_by=? AND created_at >= datetime('now','-1 hour')",
  ).bind(customer.id).first<any>();
  if (Number(recent?.total || 0) >= 5) {
    return response({ ok: false, error: 'Request limit reached. Please try again later.' }, 429);
  }

  const id = 'tpdf_' + crypto.randomUUID().replaceAll('-', '');
  const now = new Date().toISOString();
  const status = plan.status === 'blocked' ? 'blocked' : 'requested';
  await env.DB.prepare(
    'INSERT INTO topic_pdf_generation_jobs(id,request_json,plan_json,status,risk_level,requested_by,request_fingerprint,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
  ).bind(
    id,
    JSON.stringify(validated.request),
    JSON.stringify(plan),
    status,
    plan.risk.level,
    customer.id,
    requestFingerprint,
    now,
    now,
  ).run();
  await env.DB.prepare(
    'INSERT INTO topic_pdf_generation_events(id,job_id,event_type,actor,detail_json,created_at) VALUES(?,?,?,?,?,?)',
  ).bind(
    'tpdfe_' + crypto.randomUUID().replaceAll('-', ''),
    id,
    status === 'blocked' ? 'request.blocked' : 'request.accepted',
    customer.id,
    JSON.stringify({ riskLevel: plan.risk.level, domains: plan.risk.domains }),
    now,
  ).run();

  return response({
    ok: true,
    request: {
      id,
      status,
      risk_level: plan.risk.level,
      specialist_review_required: plan.risk.requiresSpecialistReview,
      target_price_usd: 7,
      sale_eligible: false,
      message: status === 'blocked'
        ? 'This request cannot be fulfilled as written.'
        : 'Your topic request has been recorded. Research, drafting and publication are not yet automatic.',
    },
  }, 202);
}
