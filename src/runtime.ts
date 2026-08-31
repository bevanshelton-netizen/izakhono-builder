import secured from './secure';

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = any>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1PreparedStatement; }
interface Env { DB: D1Database; [key: string]: unknown; }

function safeJson(value: string | null | undefined, fallback: any): any {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function generatedWorker(project: any, modules: string[]): string {
  const featureMap = modules.map(m => `  ${JSON.stringify(m)}: true`).join(',\n');
  return [
    'interface Fetcher { fetch(request: Request): Promise<Response>; }',
    'interface Env { ASSETS: Fetcher; }',
    '',
    `const APP = ${JSON.stringify(project.name)};`,
    `const FEATURES = {\n${featureMap}\n};`,
    '',
    'function json(data: unknown, status = 200) {',
    "  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });",
    '}',
    '',
    'export default {',
    '  async fetch(req: Request, env: Env): Promise<Response> {',
    '    const url = new URL(req.url);',
    "    if (url.pathname === '/api/health') return json({ ok: true, app: APP, features: FEATURES });",
    "    if (url.pathname === '/api/features') return json({ ok: true, features: FEATURES });",
    '    return env.ASSETS.fetch(req);',
    '  },',
    '};',
    '',
  ].join('\n');
}

async function hardenGeneratedBundle(env: Env, projectId: string): Promise<void> {
  const project = await env.DB.prepare('SELECT * FROM builder_projects WHERE id=?').bind(projectId).first<any>();
  if (!project) return;
  const recipe = safeJson(project.build_recipe_json, null);
  const generated = recipe?.generated;
  if (!generated?.files) return;
  const modules: string[] = safeJson(project.modules_json, []);
  generated.files['src/index.ts'] = generatedWorker(project, modules);
  generated.generator = 'IZAKHONO BUILDER codegen 0.3.1';
  generated.hardening = {
    static_assets: true,
    applied_at: new Date().toISOString(),
    note: 'Non-API requests are served through the configured ASSETS binding.',
  };
  if (generated.validation) delete generated.validation;
  generated.next_gate = 'validate_generated_bundle';
  const combined = { ...recipe, generated };
  await env.DB.prepare("UPDATE builder_projects SET build_recipe_json=?,status='building',updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(JSON.stringify(combined), projectId).run();
  await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
    .bind(`evt_${crypto.randomUUID().replaceAll('-', '')}`, projectId, 'code.hardened', 'Static asset serving added to generated Worker').run();
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const generate = url.pathname.match(/^\/api\/projects\/([^/]+)\/generate$/);
    const response = await secured.fetch(req, env as any);
    if (generate && req.method === 'POST' && response.ok) {
      await hardenGeneratedBundle(env, generate[1]);
    }
    return response;
  },
};
