import sovereignApp from './sovereign';
import { ventureFactoryRoute } from './venture-factory';

async function ownerAuthorized(req: Request, env: any): Promise<boolean> {
  const url = new URL(req.url);
  url.pathname = '/api/automation-capabilities';
  url.search = '';
  const probe = new Request(url.toString(), {
    method: 'GET',
    headers: req.headers,
  });
  const response = await sovereignApp.fetch(probe, env);
  return response.ok;
}

export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const url = new URL(req.url);
    const venture = await ventureFactoryRoute(
      req,
      env,
      url,
      () => ownerAuthorized(req, env),
    );
    if (venture) return venture;
    return sovereignApp.fetch(req, env);
  },
};
