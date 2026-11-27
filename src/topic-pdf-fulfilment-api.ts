import { resolveCustomerSession } from './customer-auth';
import { getTopicPdfSessionToken } from './topic-pdf-customer-auth-api';

interface FulfilmentStatement {
  bind(...values: unknown[]): FulfilmentStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}
interface FulfilmentEnv {
  DB: { prepare(sql: string): FulfilmentStatement };
  TOPIC_PDF_BUCKET?: {
    get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size?: number; httpMetadata?: { contentType?: string } } | null>;
  };
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

/**
 * Customer fulfilment is deliberately entitlement-gated. A generated or approved
 * editorial draft is never downloadable from this route; the publication must
 * be published and the signed-in customer must have an active paid entitlement.
 */
export async function topicPdfFulfilmentRoute(req: Request, env: FulfilmentEnv, url: URL): Promise<Response | null> {
  const library = url.pathname === '/api/topic-pdfs/library';
  const download = url.pathname.match(/^\/api\/topic-pdfs\/download\/([a-z0-9-]{8,120})$/);
  if (!library && !download) return null;
  if (req.method !== 'GET') return json({ ok: false, error: 'Method not allowed.' }, 405);
  if (req.headers.get('origin') && req.headers.get('origin') !== url.origin) {
    return json({ ok: false, error: 'Cross-origin request rejected.' }, 403);
  }
  const token = getTopicPdfSessionToken(req);
  if (!token) return json({ ok: false, error: 'A valid customer session is required.' }, 401);
  const customer = await resolveCustomerSession(env.DB as any, token);
  if (!customer) return json({ ok: false, error: 'Customer session is invalid or expired.' }, 401);

  if (library) {
    const rows = await env.DB.prepare(
      `SELECT p.slug,p.title,p.language,p.version,p.updated_at,e.purchased_at
       FROM topic_pdf_customer_entitlements e
       JOIN topic_pdf_publications p ON p.id=e.publication_id
       WHERE e.customer_id=? AND e.status='active' AND p.status='published' AND p.storage_key IS NOT NULL
       ORDER BY e.purchased_at DESC LIMIT 100`,
    ).bind(customer.id).all();
    return json({ ok: true, items: rows.results || [] });
  }

  if (!env.TOPIC_PDF_BUCKET) return json({ ok: false, error: 'Private publication storage is not configured.' }, 503);
  const item = await env.DB.prepare(
    `SELECT e.id AS entitlement_id,p.id AS publication_id,p.slug,p.title,p.storage_key
     FROM topic_pdf_customer_entitlements e
     JOIN topic_pdf_publications p ON p.id=e.publication_id
     WHERE e.customer_id=? AND e.status='active' AND p.status='published'
       AND p.storage_key IS NOT NULL AND p.slug=? LIMIT 1`,
  ).bind(customer.id, download![1]).first<any>();
  if (!item) return json({ ok: false, error: 'This guide is not available in your library.' }, 404);
  const object = await env.TOPIC_PDF_BUCKET.get(item.storage_key);
  if (!object) return json({ ok: false, error: 'The purchased guide is temporarily unavailable. Please contact support.' }, 503);
  if (object.size && object.size > 25 * 1024 * 1024) return json({ ok: false, error: 'Stored publication exceeds the delivery size limit.' }, 500);

  await env.DB.prepare(
    'INSERT INTO topic_pdf_download_events(id,entitlement_id,customer_id,publication_id,accessed_at) VALUES(?,?,?,?,?)',
  ).bind('tpdfdl_' + crypto.randomUUID().replaceAll('-', ''), item.entitlement_id, customer.id, item.publication_id, new Date().toISOString()).run();

  const safeSlug = String(item.slug).replace(/[^a-z0-9-]/g, '').slice(0, 120) || 'topic-guide';
  const headers = new Headers({
    'content-type': 'application/pdf',
    'content-disposition': 'attachment; filename="' + safeSlug + '.pdf"',
    'cache-control': 'private, no-store, max-age=0',
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-origin',
    'content-security-policy': "default-src 'none'; sandbox",
  });
  if (object.size) headers.set('content-length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}
