import { authenticateDeveloper, hasDeveloperScope } from './developer-api';
import secureApp from './secure';
import { commitInternalRepository } from './internal-repository';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

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
  const match = url.pathname.match(/^\/api\/developer\/apps\/([^/]+)\/(plan|build|verify|monetize)$/);
  if (!match) return null;

  const identity = await authenticateDeveloper(req, env);
  if (!identity) return json({ ok: false, error: 'Developer API authentication required' }, 401);

  const action = match[2];
  const requiredScope = action === 'plan' || action === 'build' || action === 'verify' || action === 'monetize' ? 'app:write' : 'developer:read';
  if (!hasDeveloperScope(identity, requiredScope)) return json({ ok: false, error: 'Insufficient scope' }, 403);
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const appId = decodeURIComponent(match[1]);
  const app = await env.DB.prepare(
    'SELECT app_id,developer_id,name,slug,stage,manifest_json,builder_project_id,verification_json,monetization_json FROM builder_app_registry WHERE app_id=? AND developer_id=?'
  ).bind(appId, identity.developer_id).first<any>();
  if (!app) return json({ ok: false, error: 'App not found' }, 404);

  const manifest = JSON.parse(app.manifest_json || '{}');

  if (action === 'plan') {
    const plan = appFactoryPlan(app.name, manifest.description || '', manifest.products || []);
    await env.DB.prepare("UPDATE builder_app_registry SET stage='building',updated_at=CURRENT_TIMESTAMP WHERE app_id=? AND developer_id=? AND stage='idea'")
      .bind(appId, identity.developer_id).run();
    return json({ ok: true, app: { ...app, stage: 'building' }, plan, next_gate: 'preview', public_live: false });
  }

  if (action === 'build') {
    if (!app.builder_project_id) return json({ ok: false, error: 'Builder project link missing' }, 409);
    if (!env.ADMIN_SECRET) return json({ ok: false, error: 'Builder internal authorization is not configured' }, 503);

    const project = await env.DB.prepare('SELECT * FROM builder_projects WHERE id=?').bind(app.builder_project_id).first<any>();
    if (!project) return json({ ok: false, error: 'Builder project not found' }, 409);

    const callBuilder = async (step: string) => {
      const target = new URL(req.url);
      target.pathname = '/api/projects/' + encodeURIComponent(project.id) + '/' + step;
      target.search = '';
      const headers = new Headers({ 'x-admin-secret': env.ADMIN_SECRET });
      return secureApp.fetch(new Request(target.toString(), { method: 'POST', headers }), env);
    };
    const responseData = async (response: Response) => {
      try { return await response.clone().json() as any; } catch { return {}; }
    };

    const planned = await callBuilder('plan');
    const plannedData = await responseData(planned);
    if (!planned.ok) return json({ ok: false, stage: 'plan', error: plannedData?.error || 'Builder planning failed' }, planned.status);

    const generatedResponse = await callBuilder('generate');
    const generatedData = await responseData(generatedResponse);
    if (!generatedResponse.ok) return json({ ok: false, stage: 'generate', error: generatedData?.error || 'Builder generation failed' }, generatedResponse.status);

    const validatedResponse = await callBuilder('validate-generated');
    const validatedData = await responseData(validatedResponse);
    if (!validatedResponse.ok || !validatedData?.validation?.passed) {
      return json({ ok: false, stage: 'validate', error: validatedData?.error || 'Generated bundle failed validation', validation: validatedData?.validation || null }, validatedResponse.status || 422);
    }

    const refreshed = await env.DB.prepare('SELECT * FROM builder_projects WHERE id=?').bind(project.id).first<any>();
    const recipe = JSON.parse(refreshed?.build_recipe_json || '{}');
    const generated = recipe?.generated;
    if (!generated?.validation?.passed || !generated?.files) {
      return json({ ok: false, stage: 'commit', error: 'Validated generated bundle is missing from Builder state' }, 500);
    }

    const internalRepository = await commitInternalRepository(env, refreshed, generated);
    const updatedGenerated = { ...generated, internal_repository: internalRepository, next_gate: 'internal_repository_committed' };
    const releaseCandidate = {
      schema: 'izakhono.release-candidate/v1',
      created_at: new Date().toISOString(),
      status: 'deploy_ready',
      revision: generated.revision,
      source_of_truth: 'izakhono-internal',
      internal_repository_head: internalRepository.head_commit_id,
      public_live: false,
      deployment_authority: 'NODE01/CODE/RUNTIME/EDGE-TLS/DNS',
      external_resilience: 'reversible',
      target_gates: {
        web_pwa: 'owned-runtime-deployment-verification',
        android: 'signed-package-plus-play-console-evidence-required',
        ios: 'signed-package-plus-app-store-connect-evidence-required',
      },
    };
    await env.DB.prepare("UPDATE builder_projects SET build_recipe_json=?,status='deploy_ready',updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(JSON.stringify({ ...recipe, generated: updatedGenerated, release_candidate: releaseCandidate }), project.id).run();
    await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
      .bind('evt_' + crypto.randomUUID().replaceAll('-', ''), project.id, 'developer_factory.release_candidate', JSON.stringify({ appId, revision: generated.revision, internal_repository_head: internalRepository.head_commit_id })).run();

    const verificationSeed = {
      status: 'pending',
      revision: generated.revision,
      projectId: project.id,
      validation_passed: true,
      internal_repository_head: internalRepository.head_commit_id,
      preview: '/preview/' + encodeURIComponent(project.slug) + '/' + encodeURIComponent(generated.revision) + '/',
      public_live: false,
    };
    await env.DB.prepare("UPDATE builder_app_registry SET stage='preview',verification_json=?,updated_at=CURRENT_TIMESTAMP WHERE app_id=? AND developer_id=?")
      .bind(JSON.stringify(verificationSeed), appId, identity.developer_id).run();

    return json({
      ok: true,
      app: { ...app, stage: 'preview' },
      build: {
        status: 'release_candidate_ready',
        revision: generated.revision,
        source_of_truth: 'izakhono-internal',
        validation_passed: true,
        internal_repository: internalRepository,
        preview: verificationSeed.preview,
        builder_project_id: project.id,
        builder_project_status: 'deploy_ready',
      },
      release_candidate: releaseCandidate,
      next_gate: 'verification',
      public_live: false,
    });
  }

  if (action === 'verify') {
    if (app.stage !== 'preview' && app.stage !== 'verified') return json({ ok:false,error:'App must reach preview before verification' },409);
    if (!app.builder_project_id) return json({ ok:false,error:'Builder project link missing' },409);
    const project = await env.DB.prepare('SELECT id,status,modules_json,build_recipe_json FROM builder_projects WHERE id=?').bind(app.builder_project_id).first<any>();
    if (!project) return json({ ok:false,error:'Builder project not found' },409);
    const checks = [
      { id:'owner_link', pass:true },
      { id:'manifest', pass:!!manifest.schema && manifest.schema === 'izakhono.app/v1' },
      { id:'builder_project', pass:project.status === 'building' || project.status === 'validated' || project.status === 'deploy_ready' || project.status === 'deployed' },
      { id:'source_of_truth', pass:(JSON.parse(project.build_recipe_json || '{}').source_of_truth === 'izakhono-internal') },
      { id:'public_live_gate', pass:true },
    ];
    const passed = checks.every(x => x.pass);
    const evidence = { schema:'izakhono.app-verification/v1', passed, checks, verified_at:new Date().toISOString(), deployment_verified:false, public_live:false };
    if (!passed) return json({ ok:false,error:'Verification gates not passed',evidence },422);
    await env.DB.prepare("UPDATE builder_app_registry SET stage='verified',verification_json=?,updated_at=CURRENT_TIMESTAMP WHERE app_id=? AND developer_id=?")
      .bind(JSON.stringify(evidence),appId,identity.developer_id).run();
    return json({ ok:true,app:{...app,stage:'verified'},verification:evidence,next_gate:'owned-runtime-deployment',public_live:false });
  }

  if (action === 'monetize') {
    if (!['preview','verified','deployed','monetizing','scaled'].includes(app.stage)) return json({ ok:false,error:'App must reach preview or verification before monetization setup' },409);
    const modes = ['subscription','usage','one_time','marketplace'];
    const config = { schema:'izakhono.app-monetization/v1', modes, provider:'FORTRESS-compatible payment adapter', production_payment_connected:false, configured:false };
    await env.DB.prepare("UPDATE builder_app_registry SET monetization_json=?,updated_at=CURRENT_TIMESTAMP WHERE app_id=? AND developer_id=?")
      .bind(JSON.stringify(config),appId,identity.developer_id).run();
    return json({ ok:true,monetization:config,next_gate:'payment-provider-configuration-and-verification',public_live:false });
  }

  return json({ ok:false,error:'Factory route not found' },404);
}
