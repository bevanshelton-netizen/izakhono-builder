import { developerApiRoute } from './developer-api';

export function appFactorySlug(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export function appFactoryPlan(name: string, description: string, products: string[] = []) {
  const modules = new Set(['auth', 'analytics', 'publish', 'integrations']);
  if (products.includes('payments') || products.includes('commerce')) modules.add('payments');
  if (products.includes('ai')) modules.add('ai');
  if (products.includes('marketplace')) modules.add('marketplace');
  if (products.includes('growth')) modules.add('growth');
  return {
    schema: 'izakhono.app-build-plan/v1',
    name,
    description,
    modules: Array.from(modules),
    gates: ['preview', 'verification', 'owned-runtime-deployment'],
    public_live: false,
  };
}

export async function appFactoryRoute(req: Request, env: any, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/developer/apps/')) return null;

  const match = url.pathname.match(/^\/api\/developer\/apps\/([^/]+)\/(plan|build|monetize)$/);
  if (!match) return null;

  const identityResponse = await developerApiRoute(req, env, url, async () => false);
  if (identityResponse?.status === 401) return identityResponse;

  // The detailed mutation is intentionally routed through the existing Builder API
  // after developer identity has been established by the developer API layer.
  const appId = decodeURIComponent(match[1]);
  const action = match[2];

  const app = await env.DB.prepare(
    'SELECT app_id,developer_id,name,slug,stage,manifest_json FROM builder_app_registry WHERE app_id=?'
  ).bind(appId).first<any>();
  if (!app) return new Response(JSON.stringify({ ok: false, error: 'App not found' }), { status: 404, headers: { 'content-type': 'application/json' } });

  if (action === 'plan' && req.method === 'POST') {
    const manifest = JSON.parse(app.manifest_json || '{}');
    const plan = appFactoryPlan(app.name, manifest.description || '', manifest.products || []);
    return new Response(JSON.stringify({ ok: true, app, plan, next_gate: 'preview', public_live: false }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }

  if (action === 'build' && req.method === 'POST') {
    await env.DB.prepare("UPDATE builder_app_registry SET stage='preview',updated_at=CURRENT_TIMESTAMP WHERE app_id=?").bind(appId).run();
    return new Response(JSON.stringify({
      ok: true,
      app: { ...app, stage: 'preview' },
      build: { status: 'preview_ready', revision: crypto.randomUUID().replaceAll('-', '').slice(0, 12), source_of_truth: 'izakhono-internal' },
      next_gate: 'verification',
      public_live: false,
    }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }

  if (action === 'monetize' && req.method === 'POST') {
    if (app.stage !== 'preview' && app.stage !== 'verified' && app.stage !== 'deployed' && app.stage !== 'monetizing') {
      return new Response(JSON.stringify({ ok: false, error: 'App must reach preview or verification before monetization setup' }), { status: 409, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      ok: true,
      monetization: {
        modes: ['subscription', 'usage', 'one_time', 'marketplace'],
        provider: 'FORTRESS-compatible payment adapter',
        production_payment_connected: false,
      },
      next_gate: 'payment-provider-configuration-and-verification',
    }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }

  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });
}
