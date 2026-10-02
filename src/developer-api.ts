export interface DeveloperApiEnv { DB: any; }

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
function clean(value: unknown, max: number): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function slug(value: string): string { return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
function keySecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return 'izk_' + btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, '').slice(0, 43);
}
function safeJson(value: string | null | undefined, fallback: any): any { try { return JSON.parse(value || ''); } catch { return fallback; } }
async function developerFromKey(req: Request, env: DeveloperApiEnv): Promise<any | null> {
  const supplied = req.headers.get('authorization') || '';
  if (!supplied.startsWith('Bearer ')) return null;
  const secret = supplied.slice(7).trim();
  if (!secret) return null;
  const hash = await sha256Hex(secret);
  const row = await env.DB.prepare(
    'SELECT c.key_id,c.developer_id,c.app_id,c.scopes_json,c.status,d.email,d.display_name,d.plan,d.status AS developer_status FROM builder_api_credentials c JOIN builder_developers d ON d.id=c.developer_id WHERE c.secret_hash=? AND c.status=\'active\' AND d.status=\'active\''
  ).bind(hash).first<any>();
  if (!row) return null;
  await env.DB.prepare('UPDATE builder_api_credentials SET last_used_at=CURRENT_TIMESTAMP WHERE key_id=?').bind(row.key_id).run();
  return { ...row, scopes: safeJson(row.scopes_json, []) };
}
function hasScope(identity: any, scope: string): boolean { return Array.isArray(identity?.scopes) && (identity.scopes.includes('*') || identity.scopes.includes(scope)); }
function id(prefix: string): string { return prefix + '_' + crypto.randomUUID().replaceAll('-', ''); }

export async function developerApiRoute(req: Request, env: DeveloperApiEnv & { ADMIN_SECRET?: string }, url: URL, ownerAuthorized: () => Promise<boolean>): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/developer/')) return null;

  if (url.pathname === '/api/developer/provision' && req.method === 'POST') {
    if (!(await ownerAuthorized())) return json({ ok: false, error: 'Unauthorized' }, 401);
    let body: any; try { body = await req.json(); } catch { return json({ ok: false, error: 'Expected application/json' }, 400); }
    const email = clean(body?.email, 200).toLowerCase();
    const displayName = clean(body?.displayName, 120);
    const plan = ['free','pro','team','business','enterprise'].includes(body?.plan) ? body.plan : 'free';
    if (!email || !displayName) return json({ ok: false, error: 'email and displayName are required' }, 400);
    const developerId = id('dev'), secret = keySecret(), keyId = id('key');
    const prefix = secret.slice(0, 12), hash = await sha256Hex(secret);
    try {
      await env.DB.prepare('INSERT INTO builder_developers(id,email,display_name,plan) VALUES(?,?,?,?)').bind(developerId, email, displayName, plan).run();
      await env.DB.prepare('INSERT INTO builder_api_credentials(key_id,developer_id,app_id,secret_hash,key_prefix,scopes_json) VALUES(?,?,?,?,?,?)')
        .bind(keyId, developerId, developerId, hash, prefix, JSON.stringify(['developer:read','developer:write','app:write','usage:write','commerce:read'])).run();
    } catch (error: any) { return json({ ok: false, error: String(error?.message || error).slice(0, 300) }, 409); }
    return json({ ok: true, developer: { id: developerId, email, displayName, plan }, credential: { keyId, keyPrefix: prefix, secret, warning: 'The secret is returned once. Store it securely; IZAKHONO stores only its hash.' } }, 201);
  }

  const identity = await developerFromKey(req, env);
  if (!identity) return json({ ok: false, error: 'Developer API authentication required' }, 401);

  if (url.pathname === '/api/developer/me' && req.method === 'GET') {
    if (!hasScope(identity, 'developer:read')) return json({ ok: false, error: 'Insufficient scope' }, 403);
    return json({ ok: true, developer: { id: identity.developer_id, email: identity.email, displayName: identity.display_name, plan: identity.plan }, credential: { keyId: identity.key_id, keyPrefix: identity.key_prefix, appId: identity.app_id, scopes: identity.scopes } });
  }

  if (url.pathname === '/api/developer/apps' && req.method === 'GET') {
    if (!hasScope(identity, 'developer:read')) return json({ ok: false, error: 'Insufficient scope' }, 403);
    const rows = await env.DB.prepare('SELECT app_id,name,slug,stage,manifest_json,created_at,updated_at FROM builder_app_registry WHERE developer_id=? ORDER BY updated_at DESC').bind(identity.developer_id).all<any>();
    return json({ ok: true, apps: rows.results || [] });
  }

  if (url.pathname === '/api/developer/apps' && req.method === 'POST') {
    if (!hasScope(identity, 'app:write')) return json({ ok: false, error: 'Insufficient scope' }, 403);
    let body: any; try { body = await req.json(); } catch { return json({ ok: false, error: 'Expected application/json' }, 400); }
    const name = clean(body?.name, 120), appSlug = slug(clean(body?.slug || name, 80));
    if (!name || appSlug.length < 2) return json({ ok: false, error: 'name and a valid slug are required' }, 400);
    const appId = id('app');
    const manifest = { schema: 'izakhono.app/v1', appId, name, slug: appSlug, ownerId: identity.developer_id, stage: 'idea', permissions: Array.isArray(body?.permissions) ? body.permissions.slice(0, 50) : [], products: Array.isArray(body?.products) ? body.products.slice(0, 50) : [] };
    try {
      await env.DB.prepare('INSERT INTO builder_app_registry(app_id,developer_id,name,slug,manifest_json) VALUES(?,?,?,?,?)').bind(appId, identity.developer_id, name, appSlug, JSON.stringify(manifest)).run();
    } catch (error: any) { return json({ ok: false, error: String(error?.message || error).slice(0, 300) }, 409); }
    return json({ ok: true, app: manifest }, 201);
  }

  if (url.pathname === '/api/developer/usage' && req.method === 'POST') {
    if (!hasScope(identity, 'usage:write')) return json({ ok: false, error: 'Insufficient scope' }, 403);
    let body: any; try { body = await req.json(); } catch { return json({ ok: false, error: 'Expected application/json' }, 400); }
    const appId = clean(body?.appId, 100), metric = clean(body?.metric, 80), quantity = Number(body?.quantity);
    const eventId = clean(body?.eventId, 120) || id('usage'), idempotencyKey = clean(body?.idempotencyKey, 180);
    if (!appId || !metric || !Number.isFinite(quantity) || quantity < 0 || !idempotencyKey) return json({ ok: false, error: 'appId, metric, non-negative quantity and idempotencyKey are required' }, 400);
    const app = await env.DB.prepare('SELECT app_id FROM builder_app_registry WHERE app_id=? AND developer_id=?').bind(appId, identity.developer_id).first<any>();
    if (!app) return json({ ok: false, error: 'App not found' }, 404);
    try {
      await env.DB.prepare('INSERT INTO builder_usage_events(event_id,app_id,developer_id,metric,quantity,occurred_at,idempotency_key) VALUES(?,?,?,?,?,?,?)')
        .bind(eventId, appId, identity.developer_id, metric, quantity, clean(body?.occurredAt, 40) || new Date().toISOString(), idempotencyKey).run();
    } catch (error: any) {
      const existing = await env.DB.prepare('SELECT event_id,app_id,metric,quantity FROM builder_usage_events WHERE idempotency_key=?').bind(idempotencyKey).first<any>();
      if (existing) return json({ ok: true, duplicate: true, usage: existing });
      return json({ ok: false, error: String(error?.message || error).slice(0, 300) }, 409);
    }
    return json({ ok: true, usage: { eventId, appId, metric, quantity, idempotencyKey } }, 201);
  }

  if (url.pathname === '/api/developer/entitlements' && req.method === 'GET') {
    if (!hasScope(identity, 'developer:read')) return json({ ok: false, error: 'Insufficient scope' }, 403);
    const appId = clean(url.searchParams.get('appId'), 100);
    const rows = await env.DB.prepare('SELECT id,app_id,product_id,status,limits_json,source,starts_at,ends_at FROM builder_entitlements WHERE developer_id=? AND (?=\'\' OR app_id=?) ORDER BY created_at DESC').bind(identity.developer_id, appId, appId).all<any>();
    return json({ ok: true, entitlements: rows.results || [] });
  }

  return json({ ok: false, error: 'Developer API route not found' }, 404);
}
