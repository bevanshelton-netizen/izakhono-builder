const APP = 'IZAKHONO Generated Worker Canary';
const FEATURES = { canary: true };

type Env = { ASSETS?: { fetch(req: Request): Promise<Response> } };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return json({ ok: true, app: APP, features: FEATURES });
    if (url.pathname === '/api/features') return json({ ok: true, features: FEATURES });
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('Not found', { status: 404 });
  },
};
