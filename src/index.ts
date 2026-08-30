interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1PreparedStatement; }
interface Fetcher { fetch(request: Request): Promise<Response>; }
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_SECRET?: string;
  APP_ENV?: string;
}

type Json = Record<string, unknown>;
const enc = new TextEncoder();
const STATUSES = ['draft','planned','building','validated','deploy_ready','deployed','paused'] as const;
const MODULES = {
  leads: { label: 'Leads & CRM', detail: 'Lead capture, statuses, notes and export.' },
  auth: { label: 'Accounts & Auth', detail: 'User sessions, roles and protected routes.' },
  uploads: { label: 'File Uploads', detail: 'R2-backed file and media storage.' },
  payments: { label: 'Payments', detail: 'Payment-intent ledger and provider adapter.' },
  email: { label: 'Email & Notifications', detail: 'Transactional queue and provider adapter.' },
  admin: { label: 'Admin Dashboard', detail: 'Operational control and reporting.' },
  analytics: { label: 'Analytics', detail: 'First-party events and product metrics.' },
  marketplace: { label: 'Marketplace', detail: 'Listings, bookings/orders and provider workflows.' },
  learning: { label: 'Learning', detail: 'Courses, lessons, assessments and progress.' },
  video: { label: 'Video', detail: 'Creator/media publishing foundation.' },
  ai: { label: 'AI Assistant', detail: 'Provider-neutral AI adapter with usage controls.' },
} as const;
type ModuleKey = keyof typeof MODULES;

function id(prefix: string) { return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`; }
function cleanText(v: unknown, max: number) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function validSlug(v: string) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 60; }
function json(req: Request, env: Env, data: unknown, status = 200) {
  const origin = req.headers.get('origin');
  const self = new URL(req.url).origin;
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'vary': 'Origin' });
  if (origin === self) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
    headers.set('access-control-allow-headers', 'content-type,x-admin-secret');
  }
  return new Response(JSON.stringify(data), { status, headers });
}
function fail(req: Request, env: Env, message: string, status = 400) { return json(req, env, { ok: false, error: message }, status); }
function isAdmin(req: Request, env: Env) { return Boolean(env.ADMIN_SECRET && req.headers.get('x-admin-secret') === env.ADMIN_SECRET); }
async function body(req: Request) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) throw new Error('Expected application/json');
  return req.json() as Promise<any>;
}
async function event(env: Env, projectId: string, eventType: string, detail = '') {
  await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
    .bind(id('evt'), projectId, eventType, detail.slice(0, 1000)).run();
}
function normalizeModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return [];
  const out: ModuleKey[] = [];
  for (const item of value) if (typeof item === 'string' && item in MODULES && !out.includes(item as ModuleKey)) out.push(item as ModuleKey);
  return out;
}
function buildRecipe(project: any, modules: ModuleKey[]) {
  const files = [
    'package.json', 'wrangler.jsonc', 'src/index.ts', 'public/index.html',
    'migrations/0001_core.sql', 'scripts/bootstrap.sh', '.github/workflows/ci.yml'
  ];
  const architecture: string[] = [
    'Cloudflare Worker API + static assets',
    'D1 relational database with migrations',
    'same-origin CORS and server-side admin secret',
    'GitHub Actions validation gate',
    'one-command bootstrap and deploy'
  ];
  if (modules.includes('uploads') || modules.includes('video')) architecture.push('R2 object/media storage');
  if (modules.includes('auth')) architecture.push('secure hashed sessions and role checks');
  if (modules.includes('payments')) architecture.push('payment intents + server-verified provider callbacks');
  if (modules.includes('email')) architecture.push('transactional email queue with swappable provider adapter');
  if (modules.includes('ai')) architecture.push('provider-neutral AI gateway; no browser API keys');
  if (modules.includes('marketplace')) architecture.push('listing/order/booking workflow schema');
  if (modules.includes('learning')) architecture.push('course/lesson/assessment/progress schema');
  if (modules.includes('analytics')) architecture.push('first-party event ledger');
  if (modules.includes('admin')) architecture.push('protected operations dashboard');
  if (modules.includes('leads')) architecture.push('lead capture and CRM workflow');

  return {
    engine: 'IZAKHONO BUILDER',
    version: '0.1',
    app: { name: project.name, slug: project.slug, category: project.category, description: project.description },
    modules,
    infrastructure_policy: 'free-first',
    files,
    architecture,
    deployment: {
      provider: 'Cloudflare',
      command: './scripts/bootstrap.sh',
      paid_upgrade_trigger: 'Only when demand, revenue, scale, compliance or a hard technical requirement justifies it.'
    },
    security: [
      'No production secret committed to source control',
      'Secrets generated or entered server-side',
      'same-origin API by default',
      'least-privilege data routes',
      'validation gate before deployment'
    ]
  };
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === 'OPTIONS') return json(req, env, { ok: true }, 204);
  if (url.pathname === '/api/health' && req.method === 'GET') {
    const row = await env.DB.prepare('SELECT 1 AS ok').first<any>();
    return json(req, env, { ok: row?.ok === 1, service: 'IZAKHONO BUILDER', version: '0.1', env: env.APP_ENV || 'production' });
  }
  if (url.pathname === '/api/modules' && req.method === 'GET') {
    return json(req, env, { ok: true, modules: Object.entries(MODULES).map(([key, value]) => ({ key, ...value })) });
  }
  if (!isAdmin(req, env)) return fail(req, env, env.ADMIN_SECRET ? 'Unauthorized' : 'Admin secret is not configured', 401);

  if (url.pathname === '/api/projects' && req.method === 'GET') {
    const rows = await env.DB.prepare('SELECT id,name,slug,category,description,modules_json,status,build_recipe_json,created_at,updated_at FROM builder_projects ORDER BY updated_at DESC').all<any>();
    return json(req, env, { ok: true, projects: (rows.results || []).map(r => ({ ...r, modules: JSON.parse(r.modules_json || '[]'), recipe: r.build_recipe_json ? JSON.parse(r.build_recipe_json) : null })) });
  }
  if (url.pathname === '/api/projects' && req.method === 'POST') {
    const b = await body(req);
    const name = cleanText(b.name, 100), slug = cleanText(b.slug, 60).toLowerCase(), category = cleanText(b.category || 'general', 60), description = cleanText(b.description || '', 600);
    const modules = normalizeModules(b.modules);
    if (!name || !validSlug(slug)) return fail(req, env, 'A name and valid lowercase slug are required');
    const projectId = id('prj');
    try {
      await env.DB.prepare('INSERT INTO builder_projects(id,name,slug,category,description,modules_json,status) VALUES(?,?,?,?,?,?,?)')
        .bind(projectId, name, slug, category, description, JSON.stringify(modules), 'draft').run();
    } catch { return fail(req, env, 'That app slug already exists', 409); }
    await event(env, projectId, 'project.created', `Created ${name}`);
    return json(req, env, { ok: true, id: projectId, name, slug, category, description, modules, status: 'draft' }, 201);
  }

  const m = url.pathname.match(/^\/api\/projects\/([^/]+)(?:\/(plan|events))?$/);
  if (m) {
    const projectId = m[1], action = m[2] || '';
    const project = await env.DB.prepare('SELECT * FROM builder_projects WHERE id=?').bind(projectId).first<any>();
    if (!project) return fail(req, env, 'Project not found', 404);
    if (!action && req.method === 'GET') {
      return json(req, env, { ok: true, project: { ...project, modules: JSON.parse(project.modules_json || '[]'), recipe: project.build_recipe_json ? JSON.parse(project.build_recipe_json) : null } });
    }
    if (!action && req.method === 'PATCH') {
      const b = await body(req);
      const status = cleanText(b.status, 30);
      if (!(STATUSES as readonly string[]).includes(status)) return fail(req, env, 'Invalid status');
      await env.DB.prepare('UPDATE builder_projects SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, projectId).run();
      await event(env, projectId, 'status.changed', status);
      return json(req, env, { ok: true, id: projectId, status });
    }
    if (action === 'plan' && req.method === 'POST') {
      const modules = normalizeModules(JSON.parse(project.modules_json || '[]'));
      const recipe = buildRecipe(project, modules);
      await env.DB.prepare("UPDATE builder_projects SET build_recipe_json=?,status='planned',updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(JSON.stringify(recipe), projectId).run();
      await event(env, projectId, 'build.planned', `${modules.length} modules`);
      return json(req, env, { ok: true, recipe });
    }
    if (action === 'events' && req.method === 'GET') {
      const rows = await env.DB.prepare('SELECT id,event_type,detail,created_at FROM builder_events WHERE project_id=? ORDER BY created_at DESC LIMIT 100').bind(projectId).all<any>();
      return json(req, env, { ok: true, events: rows.results || [] });
    }
  }
  return fail(req, env, 'Not found', 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url); }
      catch (e) { return fail(req, env, e instanceof Error ? e.message : 'Unexpected error', 500); }
    }
    return env.ASSETS.fetch(req);
  }
};
