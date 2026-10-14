/**
 * IZAKHONO FACTORY <-> SUPERAGENT bridge.
 *
 * Turns one owner brief into the real Builder flow:
 *   build-anything -> project autopilot -> release candidate.
 *
 * Authentication is deliberately delegated to the existing secured Builder
 * routes. This adapter never receives or stores secrets and never publishes
 * directly. Public deployment remains behind the existing evidence gates.
 */
import secured from './secure';

interface Env {
  DB: unknown;
  [key: string]: unknown;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { ok: false, raw: text.slice(0, 2000) }; }
}

function nestedRequest(req: Request, pathname: string, payload: Record<string, unknown>): Request {
  const headers = new Headers(req.headers);
  headers.set('content-type', 'application/json');
  headers.delete('content-length');
  return new Request(new URL(pathname, req.url), {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

async function callBuilder(req: Request, env: Env, pathname: string, payload: Record<string, unknown>) {
  return secured.fetch(nestedRequest(req, pathname, payload), env as any);
}

function projectIdFrom(value: any): string | null {
  const candidates = [
    value?.project?.id,
    value?.project_id,
    value?.id,
    value?.data?.project?.id,
    value?.data?.project_id,
  ];
  return candidates.find((item) => typeof item === 'string' && item.length > 0) ?? null;
}

export async function runFactory(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST required' }, 405);

  let input: any;
  try { input = await req.json(); } catch { return json({ ok: false, error: 'Expected application/json' }, 400); }

  const brief = typeof input?.brief === 'string' ? input.brief.trim().slice(0, 6000) : '';
  if (!brief) return json({ ok: false, error: 'brief is required' }, 400);

  // Stage 1: the existing secured Builder endpoint creates and classifies the project.
  const createResponse = await callBuilder(req, env, '/api/build-anything', { brief });
  const created = await readJson(createResponse);
  if (!createResponse.ok || created?.ok === false) {
    return json({
      ok: false,
      stage: 'build-anything',
      status: createResponse.status,
      error: created?.error || 'Builder project creation failed',
      upstream: created,
    }, createResponse.status >= 400 ? createResponse.status : 502);
  }

  const projectId = projectIdFrom(created);
  if (!projectId) {
    return json({
      ok: false,
      stage: 'build-anything',
      error: 'Builder created a response without a project id; autopilot was not attempted.',
      upstream: created,
    }, 502);
  }

  // Stage 2: use the existing one-click autopilot. It plans/generates/validates
  // and commits to the IZAKHONO internal repository, while deliberately keeping
  // public_live false until the existing deployment/acceptance gates are met.
  const autopilotResponse = await callBuilder(req, env, `/api/projects/${encodeURIComponent(projectId)}/autopilot`, {});
  const autopilot = await readJson(autopilotResponse);

  return json({
    ok: autopilotResponse.ok && autopilot?.ok !== false,
    factory: 'IZAKHONO ONE-DAY APP FACTORY',
    runtime: 'factory-superagent/v1',
    run: {
      brief,
      project_id: projectId,
      stages: [
        { id: 'intake', status: 'passed' },
        { id: 'plan', status: 'passed' },
        { id: 'route_ai', status: 'delegated-to-builder-super-ai-and-free-first-router' },
        { id: 'build', status: 'delegated-to-builder-autopilot' },
        { id: 'security', status: 'delegated-to-existing-builder-gates' },
        { id: 'qa', status: 'delegated-to-existing-builder-validation' },
        { id: 'package', status: autopilotResponse.ok ? 'passed' : 'blocked' },
        { id: 'deploy', status: 'release-candidate-only' },
        { id: 'revenue', status: 'not-auto-published' },
      ],
      public_live: false,
    },
    result: autopilot,
  }, autopilotResponse.ok ? 200 : (autopilotResponse.status >= 400 ? autopilotResponse.status : 502));
}

export default { runFactory };
