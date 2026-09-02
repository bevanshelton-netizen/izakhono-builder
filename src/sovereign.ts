import secureApp from './secure';
import {
  commitInternalRepository,
  listInternalRepository,
  readInternalRepositoryCommit,
} from './internal-repository';

const ALLOWED_MODULES = new Set([
  'leads', 'auth', 'uploads', 'payments', 'email', 'admin',
  'analytics', 'marketplace', 'learning', 'video', 'ai',
]);

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

async function editModulesRoute(req: Request, env: any, url: URL): Promise<Response | null> {
  if (req.method !== 'PATCH') return null;
  const match = url.pathname.match(/^\/api\/projects\/([^/]+)\/modules$/);
  if (!match) return null;
  if (!(await ownerAuthorized(req, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

  let payload: any = null;
  try { payload = await req.json(); } catch { return json({ ok: false, error: 'Expected application/json' }, 400); }
  if (!Array.isArray(payload?.modules)) return json({ ok: false, error: 'modules must be an array' }, 400);

  const modules = Array.from(new Set(payload.modules.filter((m: unknown) => typeof m === 'string' && ALLOWED_MODULES.has(m))));
  if (!modules.length) return json({ ok: false, error: 'Select at least one valid module' }, 400);

  const projectId = match[1];
  const project = await env.DB.prepare('SELECT id FROM builder_projects WHERE id=?').bind(projectId).first<any>();
  if (!project) return json({ ok: false, error: 'Project not found' }, 404);

  await env.DB.prepare("UPDATE builder_projects SET modules_json=?,build_recipe_json=NULL,status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(JSON.stringify(modules), projectId).run();
  await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
    .bind(`evt_${crypto.randomUUID().replaceAll('-', '')}`, projectId, 'project.modules_changed', modules.join(',')).run();

  const planUrl = new URL(req.url);
  planUrl.pathname = `/api/projects/${encodeURIComponent(projectId)}/plan`;
  const planned = await secureApp.fetch(new Request(planUrl.toString(), { method: 'POST', headers: req.headers }), env);
  if (!planned.ok) return json({ ok: false, error: 'Modules were updated, but the build plan could not be regenerated.' }, 500);

  return json({
    ok: true,
    id: projectId,
    modules,
    status: 'planned',
    message: 'Modules updated and build plan regenerated. Existing IZAKHONO repository history is preserved.',
  });
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
      project_module_editing: true,
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

const MODULE_EDITOR_SCRIPT = `<script>
(function(){
  if(typeof api!=='function'||typeof state==='undefined')return;

  window.addPayments=async function(id){
    const p=state.projects.get(id);if(!p)return;
    if(!confirm('Add the Payments module and regenerate this project build plan? Existing IZAKHONO repository history will be preserved.'))return;
    try{
      const modules=Array.from(new Set([...(p.modules||[]),'payments']));
      const d=await api('/api/projects/'+id+'/modules',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({modules})});
      await loadProjects();
      alert(d.message+' Next: Regenerate package.');
    }catch(e){alert(e.message)}
  };

  function ensurePaymentButtons(){
    const cards=Array.from(document.querySelectorAll('#projects .project'));
    const projects=Array.from(state.projects.values());
    cards.forEach(function(card,index){
      const p=projects[index];
      if(!p||!Array.isArray(p.modules)||p.modules.includes('payments'))return;
      const actions=card.querySelector('.projectActions');
      if(!actions||actions.querySelector('[data-add-payments]'))return;
      const button=document.createElement('button');
      button.className='btn';
      button.type='button';
      button.textContent='Add Payments';
      button.setAttribute('data-add-payments','1');
      button.addEventListener('click',function(){window.addPayments(p.id)});
      actions.appendChild(button);
    });
  }

  const projectsRoot=document.querySelector('#projects');
  if(projectsRoot)new MutationObserver(ensurePaymentButtons).observe(projectsRoot,{childList:true,subtree:true});
  setTimeout(ensurePaymentButtons,0);
})();
</script>`;

async function withModuleEditor(response: Response, url: URL): Promise<Response> {
  if (!response.ok) return response;
  if (url.pathname !== '/' && url.pathname !== '/index.html') return response;
  const html = await response.clone().text();
  if (!html.includes('</body>')) return response;
  const injected = html.includes("data-add-payments") ? html : html.replace('</body>', MODULE_EDITOR_SCRIPT + '</body>');
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.delete('content-length');
  return new Response(injected, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const url = new URL(req.url);

    const internal = await internalRepositoryRoute(req, env, url);
    if (internal) return internal;

    const moduleEdit = await editModulesRoute(req, env, url);
    if (moduleEdit) return moduleEdit;

    const response = await secureApp.fetch(req, env);

    if (url.pathname === '/api/automation-capabilities' && req.method === 'GET') {
      return enrichCapabilities(req, env, response);
    }

    const validation = url.pathname.match(/^\/api\/projects\/([^/]+)\/validate-generated$/);
    if (validation && req.method === 'POST') {
      return commitValidatedBundle(req, env, validation[1], response);
    }

    if (!url.pathname.startsWith('/api/')) return withModuleEditor(response, url);
    return response;
  },
};