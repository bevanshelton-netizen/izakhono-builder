interface Fetcher { fetch(request: Request): Promise<Response>; }
interface Env { ASSETS: Fetcher; }

const APP = 'FAIS Exam Prep';
const FEATURES = {
  auth: true,
  payments: true,
  email: true,
  admin: true,
  analytics: true,
  learning: true,
  ai: true,
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') {
      return json({ ok: true, app: APP, technical_proof: true, features: FEATURES });
    }
    if (url.pathname === '/api/features') {
      return json({ ok: true, features: FEATURES, technical_proof: true });
    }
    return env.ASSETS.fetch(req);
  },
};
