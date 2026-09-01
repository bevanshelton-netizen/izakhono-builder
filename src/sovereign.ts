import secureApp from './secure';
import {
  commitInternalRepository,
  listInternalRepository,
  readInternalRepositoryCommit,
} from './internal-repository';

function json(data: unknown, status = 200, source?: Response): Response {
  const headers = source ? new Headers(source.headers) : new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.delete('content-length');
  return new Response(JSON.stringify(data), { status, headers });
}

function safeJson(value: string | null | undefined, fallback: any): any {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

async function ownerAuthorized(req: Request, env: any): Promise<boolean> {
  const url = new URL(req.url);
  url.pathname = '/api/automation-capabilities';
  url.search = '';
  const probe = new Request(url.toString(), {
    method: 'GET',
    headers: req.headers,
  });
  const response = await secureApp.fetch(probe, env);
  return response.ok;
}

async function internalRepositoryRoute(req: Request, env: any, url: URL): Promise<Response | null> {
  if (req.method !== 'GET') return null;
  const match = url.pathname.match(/^\/api\/projects\/([^/]+)\/internal-repository(?:\/([^/]+))?$/);
  if (!match) return null;
  if (!(await ownerAuthorized(req, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

  const projectId = match[1];
  const requested = match[2] || '';
  const repository = await listInternalRepository(env, projectId);
  if (!repository) return json({ ok: false, error: 'Internal repository not found' }, 404);

  if (!requested) return json({ ok: true, repository });
  const commitId = requested === 'head' ? repository.head_commit_id : requested;
  if (!commitId) return json({ ok: false, error: 'Internal repository has no commits' }, 404);
  const commit = await readInternalRepositoryCommit(env, projectId, commitId);
  if (!commit) return json({ ok: false, error: 'Internal repository commit not found' }, 404);
  return json({ ok: true, repository: { slug: repository.slug, visibility: repository.visibility, head_commit_id: repository.head_commit_id }, commit });
}

async function enrichCapabilities(req: Request, env: any, response: Response): Promise<Response> {
  if (!response.ok) return response;
  let data: any = {};
  try { data = await response.clone().json(); } catch { return response; }
  return json({
    ...data,
    capabilities: {
      ...(data.capabilities || {}),
      internal_repository: true,
      internal_repository_authority: 'primary',
      external_repository_role: 'optional_mirror',
    },
  }, response.status, response);
}

async function commitValidatedBundle(req: Request, env: any, projectId: string, response: Response): Promise<Response> {
  if (!response.ok) return response;
  let data: any = {};
  try { data = await response.clone().json(); } catch { return response; }
  if (!data?.ok || !data?.validation?.passed) return response;

  const project = await env.DB.prepare('SELECT * FROM builder_projects WHERE id=?').bind(projectId).first<any>();
  if (!project) return json({ ok: false, error: 'Validated project disappeared before internal repository commit.' }, 500, response);
  const recipe = safeJson(project.build_recipe_json, null);
  const generated = recipe?.generated;
  if (!generated?.validation?.passed || !generated?.files) {
    await env.DB.prepare("UPDATE builder_projects SET status='building',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(projectId).run();
    return json({ ok: false, error: 'Validated bundle was not available for internal repository commit.' }, 500, response);
  }

  try {
    const internalRepository = await commitInternalRepository(env, project, generated);
    const updatedGenerated = {
      ...generated,
      internal_repository: internalRepository,
      next_gate: 'internal_repository_committed',
    };
    await env.DB.prepare('UPDATE builder_projects SET build_recipe_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .bind(JSON.stringify({ ...recipe, generated: updatedGenerated }), projectId).run();
    await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
      .bind(`evt_${crypto.randomUUID().replaceAll('-', '')}`, projectId, 'internal_repository.committed', internalRepository.head_commit_id).run();

    return json({
      ...data,
      internal_repository: internalRepository,
      repository_ready: true,
      source_of_truth: 'izakhono-internal',
      next_gate: 'internal_repository_committed',
    }, response.status, response);
  } catch (error: any) {
    const failure = String(error?.message || error).slice(0, 500);
    const failedGenerated = { ...generated, next_gate: 'repair_internal_repository' };
    await env.DB.prepare("UPDATE builder_projects SET build_recipe_json=?,status='building',updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(JSON.stringify({ ...recipe, generated: failedGenerated }), projectId).run();
    await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
      .bind(`evt_${crypto.randomUUID().replaceAll('-', '')}`, projectId, 'internal_repository.commit_failed', failure).run();
    return json({ ok: false, error: `Generated validation passed, but IZAKHONO internal repository commit failed: ${failure}` }, 500, response);
  }
}

export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const url = new URL(req.url);

    const internal = await internalRepositoryRoute(req, env, url);
    if (internal) return internal;

    const response = await secureApp.fetch(req, env);

    if (url.pathname === '/api/automation-capabilities' && req.method === 'GET') {
      return enrichCapabilities(req, env, response);
    }

    const validation = url.pathname.match(/^\/api\/projects\/([^/]+)\/validate-generated$/);
    if (validation && req.method === 'POST') {
      return commitValidatedBundle(req, env, validation[1], response);
    }

    return response;
  },
};
