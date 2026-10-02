import secureApp from './secure';
import { ventureFactoryRoute } from './venture-factory';
import { reviewLoopRoute } from './reviewloop';
import { bidForgeRoute } from './bidforge';
import { developerApiRoute } from './developer-api';
import { COMMANDS, commandStats, commandSummary, findCommand } from './commands';
import {
  commitInternalRepository,
  listInternalRepository,
  readInternalRepositoryCommit,
} from './internal-repository';

const ALLOWED_MODULES = new Set([
  'leads', 'auth', 'uploads', 'payments', 'email', 'notifications', 'chat',
  'speech', 'transcription', 'recurring', 'roles', 'integrations', 'publish',
  'admin', 'analytics', 'marketplace', 'learning', 'video', 'ai', 'revenue',
  'artist_protect', 'career', 'media_handoff', 'clearset', 'growth', 'affiliate',
  'docflow', 'game', 'seo',
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


function ventureSlug(input: string) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52) || 'venture';
}

async function secureJson(response: Response): Promise<any> {
  try { return await response.clone().json(); } catch { return {}; }
}

async function ventureFactoryBuildRoute(req: Request, env: any, url: URL): Promise<Response | null> {
  const match = url.pathname.match(/^\/api\/venture-factory\/ideas\/([^/]+)\/build$/);
  if (!match || req.method !== 'POST') return null;
  if (!(await ownerAuthorized(req, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

  const ideaId = decodeURIComponent(match[1]);
  const ideaRow = await env.DB.prepare(
    'SELECT id,idea,country,monthly_price_zar,target_monthly_revenue_zar,plan_json,created_at FROM venture_ideas WHERE id=?'
  ).bind(ideaId).first<any>();
  if (!ideaRow) return json({ ok: false, error: 'Venture idea not found' }, 404);

  const plan = safeJson(ideaRow.plan_json, null);
  if (!plan?.venture || !plan?.build) return json({ ok: false, error: 'Venture plan is incomplete' }, 409);

  const name = String(plan.venture.name || 'IZAKHONO Venture').trim().slice(0, 100);
  const baseSlug = ventureSlug(name);
  const suffix = String(ideaId).replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
  let slug = baseSlug;
  const existing = await env.DB.prepare('SELECT id,name,slug,status FROM builder_projects WHERE slug=?').bind(slug).first<any>();
  if (existing) {
    const linked = await env.DB.prepare(
      "SELECT detail FROM builder_events WHERE project_id=? AND event_type='venture_factory.promoted' ORDER BY created_at DESC LIMIT 1"
    ).bind(existing.id).first<any>();
    if (linked?.detail === ideaId) {
      return json({
        ok: true,
        already_built: true,
        project: existing,
        message: 'This Venture Factory idea already has an IZAKHONO Builder project.',
        public_live: false,
      });
    }
    slug = (baseSlug.slice(0, Math.max(1, 52 - suffix.length - 1)) + '-' + suffix).replace(/-+$/,'');
  }

  const modules = Array.isArray(plan.build.product_modules) ? plan.build.product_modules : [
    'auth','leads','ai','payments','admin','analytics','revenue','integrations','publish','growth'
  ];
  const description = String(
    plan.venture.one_line_offer ||
    ('Venture Factory project generated from idea: ' + String(ideaRow.idea || ''))
  ).slice(0, 600);
  const category = String(plan.venture.category || 'AI Workflow SaaS').slice(0, 60);

  const createUrl = new URL(req.url);
  createUrl.pathname = '/api/projects';
  createUrl.search = '';
  const createHeaders = new Headers(req.headers);
  createHeaders.set('content-type', 'application/json');

  const created = await secureApp.fetch(new Request(createUrl.toString(), {
    method: 'POST',
    headers: createHeaders,
    body: JSON.stringify({ name, slug, category, description, modules }),
  }), env);
  const createdData = await secureJson(created);
  if (!created.ok) return json({ ok: false, stage: 'create', ...createdData }, created.status);

  const projectId = createdData.id;
  if (!projectId) return json({ ok: false, stage: 'create', error: 'Builder did not return a project id' }, 500);

  await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
    .bind(`evt_${crypto.randomUUID().replaceAll('-', '')}`, projectId, 'venture_factory.promoted', ideaId).run();

  const callProject = async (action: string) => {
    const target = new URL(req.url);
    target.pathname = `/api/projects/${encodeURIComponent(projectId)}/${action}`;
    target.search = '';
    return secureApp.fetch(new Request(target.toString(), { method: 'POST', headers: req.headers }), env);
  };

  const planned = await callProject('plan');
  const plannedData = await secureJson(planned);
  if (!planned.ok) return json({ ok: false, stage: 'plan', project: createdData, ...plannedData }, planned.status);

  const generated = await callProject('generate');
  const generatedData = await secureJson(generated);
  if (!generated.ok) return json({ ok: false, stage: 'generate', project: createdData, ...generatedData }, generated.status);

  const validated = await callProject('validate-generated');
  const committed = await commitValidatedBundle(req, env, projectId, validated);
  const validationData = await secureJson(committed);
  if (!committed.ok) return json({ ok: false, stage: 'validate', project: createdData, ...validationData }, committed.status);

  return json({
    ok: true,
    project: {
      id: projectId,
      name,
      slug,
      category,
      status: 'validated',
    },
    venture_idea_id: ideaId,
    build: {
      planned: true,
      generated: true,
      validation_passed: Boolean(validationData?.validation?.passed),
      internal_repository: validationData?.internal_repository || null,
      preview: validationData?.preview || null,
    },
    public_live: false,
    next_gate: 'deployment-verification',
    message: 'Venture promoted into IZAKHONO Builder, generated, validated and committed to the IZAKHONO internal repository. Public deployment remains gated.',
  });
}


const BUILD_TARGETS = new Set(['website', 'app', 'game', 'software']);

function inferBuildTarget(prompt: string, explicit = ''): string {
  const requested = String(explicit || '').toLowerCase().trim();
  if (BUILD_TARGETS.has(requested)) return requested;
  const p = String(prompt || '').toLowerCase();
  if (/\b(game|gaming|player|level|racing|quiz game|arcade)\b/.test(p)) return 'game';
  if (/\b(website|web site|landing page|storefront|site)\b/.test(p)) return 'website';
  if (/\b(software|desktop|system|tool|crm|erp|saas)\b/.test(p)) return 'software';
  return 'app';
}

function buildNameFromPrompt(prompt: string, target: string): string {
  const cleaned = String(prompt || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\b(please|build|create|make|develop|design|generate|an?|the|for me)\b/gi, ' ')
    .replace(/\b(website|web site|app|application|game|software|platform|system)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean).slice(0, 6);
  const base = words.length ? words.join(' ') : ('New ' + target);
  return base.replace(/\b\w/g, ch => ch.toUpperCase()).slice(0, 90);
}

function buildModulesFromPrompt(prompt: string, target: string): string[] {
  const p = String(prompt || '').toLowerCase();
  const modules = new Set<string>(['ai', 'integrations', 'publish', 'growth', 'admin', 'analytics']);
  if (target === 'website') modules.add('seo');
  if (target === 'game') { modules.add('game'); modules.add('uploads'); }
  if (/\b(pay|payment|checkout|sell|shop|store|order|invoice|subscription|booking|bookings)\b/.test(p)) {
    modules.add('payments'); modules.add('revenue');
  }
  if (/\b(marketplace|vendors?|providers?|buyers?|sellers?)\b/.test(p)) modules.add('marketplace');
  if (/\b(course|learn|student|school|academy|training|lesson|quiz|exam)\b/.test(p)) modules.add('learning');
  if (/\b(chat|message|community|social|comment|notification)\b/.test(p)) { modules.add('chat'); modules.add('notifications'); }
  if (/\b(upload|photo|image|video|media|gallery|portfolio)\b/.test(p)) modules.add('uploads');
  if (/\b(video|movie|film|stream|creator)\b/.test(p)) modules.add('video');
  if (/\b(email|newsletter|mail)\b/.test(p)) modules.add('email');
  if (/\b(affiliate|referral|commission|partner network)\b/.test(p)) modules.add('affiliate');
  if (/\b(document|proposal|contract|agreement|pdf|signature|signing)\b/.test(p)) modules.add('docflow');
  if (/\b(schedule|scheduled|recurring|automation|workflow|reminder)\b/.test(p)) modules.add('recurring');
  if (/\b(team|staff|role|permission|admin users?)\b/.test(p)) modules.add('roles');
  if (/\b(audio|voice|speech|narrat)\b/.test(p)) modules.add('speech');
  if (/\b(transcrib|caption|subtitle)\b/.test(p)) modules.add('transcription');
  return Array.from(modules).filter(m => ALLOWED_MODULES.has(m));
}


function parseBuildAiJson(text: string): any | null {
  const raw = String(text || '').trim().replace(/^`{3}(?:json)?\s*/i, '').replace(/\s*`{3}$/, '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
  }
  return null;
}

async function enrichBuildIntentWithSuperAI(env: any, prompt: string, base: any): Promise<any> {
  const fallback = (reason: string) => ({ ...base, intelligence: { mode: 'deterministic-fallback', reason } });
  if (!env.IZAKHONO_SUPER_AI_URL || !env.IZAKHONO_SUPER_AI_INTERNAL_KEY || !env.IZAKHONO_SUPER_AI_WORKFLOW_KEY) {
    return fallback('super-ai-not-configured');
  }

  const endpoint = String(env.IZAKHONO_SUPER_AI_URL).replace(/\/+$/, '') + '/api/v1/generate';
  const instruction = [
    'You are the product architect inside IZAKHONO BUILDER.',
    'Convert the owner brief into a concise build intent. Return ONLY valid JSON.',
    'Allowed target values: app, website, game, software.',
    'Allowed modules: ' + Array.from(ALLOWED_MODULES).join(', ') + '.',
    'Never add secrets, paid-spend instructions, external publishing, legal acceptance or destructive actions.',
    'JSON keys: name (string), target (string), modules (array of allowed strings), summary (string), build_priorities (array of strings).',
    'Owner brief: ' + prompt,
    'Deterministic baseline: ' + JSON.stringify(base),
  ].join('\n');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-izakhono-ai-key': String(env.IZAKHONO_SUPER_AI_INTERNAL_KEY),
        'x-izakhono-ai-workflow-key': String(env.IZAKHONO_SUPER_AI_WORKFLOW_KEY),
      },
      body: JSON.stringify({
        entity_id: 'izakhono-africa',
        product: 'izakhono-builder',
        access_mode: 'workflow',
        capability: 'reasoning',
        messages: [
          { role: 'system', content: 'Return strict JSON only. Stay inside the allowed target/module lists.' },
          { role: 'user', content: instruction },
        ],
      }),
    });
    if (!response.ok) return fallback('super-ai-http-' + response.status);
    const data: any = await response.json();
    const parsed = parseBuildAiJson(String(data?.output?.text || data?.answer || ''));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback('super-ai-invalid-json');

    const target = BUILD_TARGETS.has(String(parsed.target || '').toLowerCase())
      ? String(parsed.target).toLowerCase()
      : base.target;
    const aiModules = Array.isArray(parsed.modules)
      ? parsed.modules.filter((m: unknown) => typeof m === 'string' && ALLOWED_MODULES.has(m))
      : [];
    const modules = Array.from(new Set([...(base.modules || []), ...aiModules]));
    const name = String(parsed.name || '').trim().slice(0, 100) || base.name;
    const summary = String(parsed.summary || '').trim().slice(0, 600);
    const priorities = Array.isArray(parsed.build_priorities)
      ? parsed.build_priorities.filter((x: unknown) => typeof x === 'string').map((x: string) => x.trim().slice(0, 240)).filter(Boolean).slice(0, 12)
      : [];

    return {
      ...base,
      target,
      name,
      modules,
      summary,
      build_priorities: priorities,
      intelligence: {
        mode: 'super-ai',
        service: 'IZAKHONO SUPER AI',
        capability: 'reasoning',
        model: String(data?.model || '').slice(0, 120) || null,
        owner_only: data?.owner_only === true,
      },
    };
  } catch {
    return fallback('super-ai-unavailable');
  }
}

async function uniqueBuildSlug(env: any, desired: string): Promise<string> {
  const base = ventureSlug(desired).slice(0, 52);
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const exists = await env.DB.prepare('SELECT id FROM builder_projects WHERE slug=?').bind(candidate).first<any>();
    if (!exists) return candidate;
    const suffix = '-' + crypto.randomUUID().replaceAll('-', '').slice(0, 5);
    candidate = (base.slice(0, Math.max(1, 60 - suffix.length)) + suffix).replace(/-+$/, '');
  }
  return ('build-' + crypto.randomUUID().replaceAll('-', '').slice(0, 12)).toLowerCase();
}

async function buildAnythingRoute(req: Request, env: any, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/build-anything' || req.method !== 'POST') return null;
  if (!(await ownerAuthorized(req, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

  let payload: any = null;
  try { payload = await req.json(); } catch { return json({ ok: false, error: 'Expected application/json' }, 400); }

  const prompt = String(payload?.prompt || '').trim().slice(0, 1200);
  if (prompt.length < 8) return json({ ok: false, error: 'Describe what you want to build in at least one short sentence.' }, 400);

  const deterministicTarget = inferBuildTarget(prompt, payload?.target);
  const deterministicName = buildNameFromPrompt(prompt, deterministicTarget);
  const baseline = {
    target: deterministicTarget,
    name: deterministicName,
    modules: buildModulesFromPrompt(prompt, deterministicTarget),
  };
  const intent = await enrichBuildIntentWithSuperAI(env, prompt, baseline);
  const target = inferBuildTarget(prompt, payload?.target || intent.target);
  const name = String(payload?.name || '').trim().slice(0, 100) || String(intent.name || deterministicName).slice(0, 100);
  const slug = await uniqueBuildSlug(env, String(payload?.slug || name));
  const modules = Array.from(new Set([...(baseline.modules || []), ...(intent.modules || [])])).filter(m => ALLOWED_MODULES.has(m));
  const category = target === 'website' ? 'website' : target === 'game' ? 'game' : target === 'software' ? 'software' : 'general';

  const createUrl = new URL(req.url);
  createUrl.pathname = '/api/projects';
  createUrl.search = '';
  const createHeaders = new Headers(req.headers);
  createHeaders.set('content-type', 'application/json');
  const created = await secureApp.fetch(new Request(createUrl.toString(), {
    method: 'POST',
    headers: createHeaders,
    body: JSON.stringify({ name, slug, category, description: prompt, modules }),
  }), env);
  const createdData = await secureJson(created);
  if (!created.ok) return json({ ok: false, stage: 'create', ...createdData }, created.status);

  const projectId = String(createdData.id || '');
  if (!projectId) return json({ ok: false, stage: 'create', error: 'Builder did not return a project id' }, 500);

  await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
    .bind('evt_' + crypto.randomUUID().replaceAll('-', ''), projectId, 'build_anything.prompt', prompt.slice(0, 1000)).run();

  const autopilotUrl = new URL(req.url);
  autopilotUrl.pathname = '/api/projects/' + encodeURIComponent(projectId) + '/autopilot';
  autopilotUrl.search = '';
  const autopilotReq = new Request(autopilotUrl.toString(), { method: 'POST', headers: req.headers });
  const autopilot = await projectAutopilotRoute(autopilotReq, env, autopilotUrl);
  if (!autopilot) return json({ ok: false, stage: 'autopilot', error: 'Builder autopilot route unavailable' }, 500);
  const autopilotData = await secureJson(autopilot);
  if (!autopilot.ok) return json({ ok: false, stage: autopilotData?.stage || 'autopilot', project: createdData, ...autopilotData }, autopilot.status);

  return json({
    ok: true,
    product: 'IZAKHONO BUILD ANYTHING',
    prompt,
    inference: { target, name, slug, category, modules, summary: intent.summary || null, build_priorities: intent.build_priorities || [], intelligence: intent.intelligence || { mode: 'deterministic-fallback' } },
    project: { id: projectId, name, slug, category, status: autopilotData?.project?.status || 'deploy_ready' },
    build: {
      planned: true,
      generated: Boolean(autopilotData?.build?.generated),
      revision: autopilotData?.build?.revision || null,
      validation_passed: Boolean(autopilotData?.build?.validation_passed),
      internal_repository: autopilotData?.build?.internal_repository || null,
      preview: autopilotData?.build?.preview || null,
    },
    release_candidate: autopilotData?.release_candidate || null,
    public_live: false,
    next_gate: autopilotData?.next_gate || 'owned-runtime-deployment-verification',
    message: 'One-sentence build completed through IZAKHONO Builder autopilot and produced a controlled release candidate. Public deployment remains evidence-gated.',
  });
}

async function projectAutopilotRoute(req: Request, env: any, url: URL): Promise<Response | null> {
  const match = url.pathname.match(/^\/api\/projects\/([^/]+)\/autopilot$/);
  if (!match || req.method !== 'POST') return null;
  if (!(await ownerAuthorized(req, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

  const projectId = match[1];
  let project = await env.DB.prepare('SELECT * FROM builder_projects WHERE id=?').bind(projectId).first<any>();
  if (!project) return json({ ok: false, error: 'Project not found' }, 404);

  let recipe = safeJson(project.build_recipe_json, null);
  const currentGenerated = recipe?.generated;
  const existingCandidate = recipe?.release_candidate;
  if (
    project.status === 'deploy_ready' &&
    currentGenerated?.validation?.passed &&
    currentGenerated?.internal_repository?.head_commit_id &&
    existingCandidate?.revision === currentGenerated?.revision
  ) {
    return json({
      ok: true,
      already_ready: true,
      project: { id: project.id, name: project.name, slug: project.slug, status: project.status },
      release_candidate: existingCandidate,
      internal_repository: currentGenerated.internal_repository,
      preview: `/preview/${encodeURIComponent(project.slug)}/${encodeURIComponent(currentGenerated.revision)}/`,
      public_live: false,
      next_gate: 'owned-runtime-deployment-verification',
    });
  }

  const call = async (action: string) => {
    const target = new URL(req.url);
    target.pathname = `/api/projects/${encodeURIComponent(projectId)}/${action}`;
    target.search = '';
    return secureApp.fetch(new Request(target.toString(), { method: 'POST', headers: req.headers }), env);
  };

  if (!recipe) {
    const planned = await call('plan');
    const plannedData = await secureJson(planned);
    if (!planned.ok) return json({ ok: false, stage: 'plan', ...plannedData }, planned.status);
    project = await env.DB.prepare('SELECT * FROM builder_projects WHERE id=?').bind(projectId).first<any>();
    recipe = safeJson(project?.build_recipe_json, null);
  }

  let validationData: any = null;
  if (recipe?.generated?.validation?.passed && recipe?.generated?.internal_repository?.head_commit_id) {
    validationData = {
      ok: true,
      validation: recipe.generated.validation,
      internal_repository: recipe.generated.internal_repository,
      preview: `/preview/${encodeURIComponent(project.slug)}/${encodeURIComponent(recipe.generated.revision)}/`,
    };
  } else {
    const generated = await call('generate');
    const generatedData = await secureJson(generated);
    if (!generated.ok) return json({ ok: false, stage: 'generate', ...generatedData }, generated.status);

    const validated = await call('validate-generated');
    const committed = await commitValidatedBundle(req, env, projectId, validated);
    validationData = await secureJson(committed);
    if (!committed.ok) {
      return json({ ok: false, stage: 'validate', ...validationData }, committed.status);
    }
  }

  project = await env.DB.prepare('SELECT * FROM builder_projects WHERE id=?').bind(projectId).first<any>();
  recipe = safeJson(project?.build_recipe_json, null);
  const generated = recipe?.generated;
  if (!generated?.validation?.passed || !generated?.internal_repository?.head_commit_id) {
    return json({ ok: false, stage: 'release-candidate', error: 'Validated internal repository proof is missing.' }, 409);
  }

  const releaseCandidate = {
    schema: 'izakhono.release-candidate/v1',
    created_at: new Date().toISOString(),
    status: 'deploy_ready',
    revision: generated.revision,
    source_of_truth: 'izakhono-internal',
    internal_repository_head: generated.internal_repository.head_commit_id,
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
    .bind(JSON.stringify({ ...recipe, release_candidate: releaseCandidate }), projectId).run();
  await env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
    .bind(`evt_${crypto.randomUUID().replaceAll('-', '')}`, projectId, 'release_candidate.ready', generated.revision).run();

  return json({
    ok: true,
    project: { id: project.id, name: project.name, slug: project.slug, status: 'deploy_ready' },
    build: {
      generated: true,
      validation_passed: true,
      revision: generated.revision,
      internal_repository: generated.internal_repository,
      preview: validationData?.preview || `/preview/${encodeURIComponent(project.slug)}/${encodeURIComponent(generated.revision)}/`,
    },
    release_candidate: releaseCandidate,
    public_live: false,
    next_gate: 'owned-runtime-deployment-verification',
    message: 'One-click Builder autopilot completed: package generated, validation passed, source committed to the IZAKHONO internal repository and a controlled release candidate was created. Nothing was published publicly.',
  });
}

async function faisPaymentsRepairApi(req: Request, env: any, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/owner-actions/fais-add-payments' || req.method !== 'POST') return null;
  if (!(await ownerAuthorized(req, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

  const project = await env.DB.prepare("SELECT id,slug,modules_json FROM builder_projects WHERE slug IN ('faisready','fais-exam-prep') ORDER BY CASE slug WHEN 'faisready' THEN 0 ELSE 1 END LIMIT 1").first<any>();
  if (!project) return json({ ok: false, error: 'FAIS Exam Prep project not found' }, 404);
  const current = safeJson(project.modules_json, []);
  if (!Array.isArray(current)) return json({ ok: false, error: 'FAIS module state is invalid' }, 500);
  if (current.includes('payments')) return json({ ok: true, already_present: true, id: project.id, modules: current, message: 'Payments is already enabled.' });

  const modules = Array.from(new Set([...current.filter((m: unknown) => typeof m === 'string' && ALLOWED_MODULES.has(m)), 'payments']));
  const editUrl = new URL(req.url);
  editUrl.pathname = `/api/projects/${encodeURIComponent(project.id)}/modules`;
  const editReq = new Request(editUrl.toString(), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-admin-secret': req.headers.get('x-admin-secret') || '' },
    body: JSON.stringify({ modules }),
  });
  const edited = await editModulesRoute(editReq, env, editUrl);
  if (!edited) return json({ ok: false, error: 'Module editor unavailable' }, 500);
  const data = await edited.clone().json<any>().catch(() => ({}));
  if (!edited.ok) return json(data, edited.status);
  return json({ ...data, action: 'fais-add-payments', message: 'Payments added to FAIS Exam Prep. Build plan regenerated; existing IZAKHONO repository history preserved.' });
}

function faisPaymentsRepairPage(url: URL): Response | null {
  if (url.pathname !== '/owner-actions/fais-add-payments') return null;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IZAKHONO Owner Repair</title><style>body{font-family:system-ui;background:#07120f;color:#f4fff9;margin:0;padding:30px}.box{max-width:620px;margin:8vh auto;background:#0d1b17;border:1px solid #244238;border-radius:18px;padding:24px}h1{margin-top:0}p{color:#b8cec4;line-height:1.55}input,button{width:100%;box-sizing:border-box;padding:13px;border-radius:10px;font:inherit}input{background:#06100e;border:1px solid #36594c;color:white;margin:10px 0}button{border:0;background:#64f3a5;color:#04110d;font-weight:900;cursor:pointer}.msg{margin-top:15px;white-space:pre-wrap}.ok{color:#64f3a5}.bad{color:#ff9898}</style></head><body><div class="box"><h1>FAIS Exam Prep — Add Payments</h1><p>This repairs the existing project only. It does not create a new project and does not delete the existing IZAKHONO repository history.</p><label>Owner recovery key</label><input id="key" type="password" autocomplete="off" placeholder="Enter owner recovery key"><button id="go">Add Payments to existing FAIS project</button><div class="msg" id="msg"></div></div><script>const key=document.querySelector('#key');const msg=document.querySelector('#msg');document.querySelector('#go').onclick=async()=>{msg.className='msg';msg.textContent='Updating existing project…';try{const r=await fetch('/api/owner-actions/fais-add-payments',{method:'POST',headers:{'x-admin-secret':key.value.trim()}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Update failed');msg.className='msg ok';msg.textContent=d.message+'\n\nNext: return to IZAKHONO BUILDER and regenerate the package.';}catch(e){msg.className='msg bad';msg.textContent=e.message||String(e)}};</script></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
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
      one_click_release_candidate: true,
      release_candidate_public_live_implied: false,
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
  window.autopilotProject=async function(id){
    const p=state.projects.get(id);if(!p)return;
    if(!confirm('Build '+p.name+' through package generation, validation, IZAKHONO internal repository commit and release-candidate preparation? This will not publish it publicly.'))return;
    try{
      const d=await api('/api/projects/'+id+'/autopilot',{method:'POST'});
      await loadProjects();
      const proof=d.release_candidate?.revision||d.build?.revision||'ready';
      alert('Release candidate '+proof+' is ready. Public deployment remains gated until owned-runtime HTTPS and acceptance verification pass.');
      if(d.build?.preview)window.open(d.build.preview,'_blank','noopener');
      else if(d.preview)window.open(d.preview,'_blank','noopener');
    }catch(e){alert(e.message)}
  };
  window.importHandoffAndBuild=async function(){
    if(!state.secret){alert('Unlock Owner Access first.');return}
    const input=document.querySelector('#handoffFile');
    const file=input?.files?.[0];
    if(!file){alert('Choose an IZAKHONO handoff JSON file first.');return}
    if(file.size>262144){alert('Handoff file is too large.');return}
    try{
      const payload=JSON.parse(await file.text());
      const imported=await api('/api/import-handoff',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const projectId=imported?.project?.id;
      if(!projectId)throw new Error('The handoff import did not return a project id.');
      const d=await api('/api/projects/'+projectId+'/autopilot',{method:'POST'});
      input.value='';
      await loadProjects();
      alert('Handoff imported and built to a controlled release candidate. Nothing was published publicly.');
      if(d.build?.preview)window.open(d.build.preview,'_blank','noopener');
    }catch(e){alert(e.message)}
  };
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
      if(!actions)return;
      if(!actions.querySelector('[data-autopilot]')){
        const auto=document.createElement('button');
        auto.className='btn primary';auto.type='button';auto.textContent=p.status==='deploy_ready'?'Recheck release candidate':'Build to release candidate';auto.setAttribute('data-autopilot','1');
        auto.addEventListener('click',function(){window.autopilotProject(p.id)});actions.appendChild(auto);
      }
      if(p.modules.includes('payments')||actions.querySelector('[data-add-payments]'))return;
      const button=document.createElement('button');
      button.className='btn';button.type='button';button.textContent='Add Payments';button.setAttribute('data-add-payments','1');
      button.addEventListener('click',function(){window.addPayments(p.id)});actions.appendChild(button);
    });
  }
  const projectsRoot=document.querySelector('#projects');
  if(projectsRoot)new MutationObserver(ensurePaymentButtons).observe(projectsRoot,{childList:true,subtree:true});
  const handoffInput=document.querySelector('#handoffFile');
  if(handoffInput){
    const row=handoffInput.parentElement;
    if(row&&!row.querySelector('[data-import-autopilot]')){
      const button=document.createElement('button');
      button.className='btn primary';button.type='button';button.textContent='Import & Build';button.setAttribute('data-import-autopilot','1');
      button.addEventListener('click',window.importHandoffAndBuild);row.appendChild(button);
    }
  }
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


function commandParts(input: string) {
  const clean = String(input || '').trim().replace(/^\/+/, '');
  const match = clean.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  return { token: (match?.[1] || '').toLowerCase(), args: (match?.[2] || '').trim() };
}

async function commandResponseData(response: Response): Promise<any> {
  try { return await response.clone().json(); } catch { return {}; }
}

async function commandProject(env: any, slug: string): Promise<any | null> {
  return env.DB.prepare('SELECT * FROM builder_projects WHERE slug=?').bind(String(slug || '').toLowerCase()).first<any>();
}

function compactCommandProject(project: any) {
  const recipe = safeJson(project?.build_recipe_json, null);
  return {
    id: project?.id,
    name: project?.name,
    slug: project?.slug,
    category: project?.category,
    modules: safeJson(project?.modules_json, []),
    status: project?.status,
    updated_at: project?.updated_at,
    revision: recipe?.generated?.revision || null,
    validation_passed: Boolean(recipe?.generated?.validation?.passed),
    internal_repository: recipe?.generated?.internal_repository || null,
  };
}

async function commandSecureRequest(req: Request, env: any, path: string): Promise<Response> {
  const target = new URL(req.url);
  target.pathname = path;
  target.search = '';
  return secureApp.fetch(new Request(target.toString(), { method: 'POST', headers: req.headers }), env);
}

async function commandApiRoute(req: Request, env: any, url: URL): Promise<Response | null> {
  const catalogue = url.pathname === '/api/commands' && req.method === 'GET';
  const run = url.pathname === '/api/commands/run' && req.method === 'POST';
  if (!catalogue && !run) return null;
  if (!(await ownerAuthorized(req, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

  if (catalogue) {
    return json({
      ok: true,
      stats: commandStats(),
      commands: COMMANDS.map(commandSummary),
      execution_boundary: 'Only whitelisted IZAKHONO actions execute. Workflow commands open structured workflows; no arbitrary shell execution is accepted.',
    });
  }

  let payload: any = null;
  try { payload = await req.json(); } catch { return json({ ok: false, error: 'Expected application/json' }, 400); }
  const input = String(payload?.input || '').trim();
  if (!input) return json({ ok: false, error: 'Enter a command.' }, 400);

  const parts = commandParts(input);
  const definition = findCommand(input);
  if (!definition) return json({ ok: false, error: 'Unknown command /' + parts.token + '. Use /commands to browse the catalogue.' }, 404);
  if (definition.requiresArg && !parts.args) return json({ ok: false, error: '/' + definition.name + ' requires an argument.' }, 400);

  if (definition.kind === 'launcher') {
    return json({ ok: true, command: definition.name, kind: definition.kind, navigate: definition.path, message: definition.label + ' launcher ready.' });
  }
  if (definition.kind === 'workflow') {
    return json({ ok: true, command: definition.name, kind: definition.kind, args: parts.args, workflow: commandSummary(definition), message: 'Structured workflow opened. Provider-specific or irreversible actions remain explicit approval gates.' });
  }
  if (definition.name === 'commands') {
    return json({ ok: true, command: 'commands', kind: 'action', message: String(COMMANDS.length) + ' owner commands are available.', data: { stats: commandStats() } });
  }
  if (definition.name === 'health') {
    const row = await env.DB.prepare('SELECT 1 AS ok').first<any>();
    return json({ ok: row?.ok === 1, command: 'health', kind: 'action', message: row?.ok === 1 ? 'IZAKHONO command engine and Builder database are responding.' : 'Database health proof failed.', data: { database: row?.ok === 1 ? 'ready' : 'unverified', command_engine: 'ready' } }, row?.ok === 1 ? 200 : 503);
  }
  if (definition.name === 'portfolio') {
    const rows = await env.DB.prepare('SELECT * FROM builder_projects ORDER BY updated_at DESC').all<any>();
    const projects = (rows.results || []).map(compactCommandProject);
    return json({ ok: true, command: 'portfolio', kind: 'action', message: String(projects.length) + ' projects loaded.', data: { projects } });
  }

  if (['infra', 'node', 'deploy-status', 'job', 'deploy'].includes(definition.name)) {
    return json({
      ok: false,
      command: definition.name,
      error: 'This command executes only on the IZAKHONO-owned Command Gateway through CONTROL → NODE.',
      execution_boundary: 'owned-node-required',
      owned_route: 'http://127.0.0.1:8091/commands',
    }, 503);
  }

  const slug = parts.args.split(/\s+/)[0].toLowerCase();
  const project = await commandProject(env, slug);
  if (!project) return json({ ok: false, error: 'Project slug "' + slug + '" was not found.' }, 404);

  if (definition.name === 'project') {
    return json({ ok: true, command: 'project', kind: 'action', message: project.name + ' status loaded.', data: compactCommandProject(project) });
  }
  if (definition.name === 'repo') {
    const repository = await listInternalRepository(env, project.id);
    if (!repository) return json({ ok: false, error: 'Internal repository not found. Validate and commit the project first.' }, 404);
    return json({ ok: true, command: 'repo', kind: 'action', message: project.name + ' internal repository loaded.', data: repository });
  }
  if (definition.name === 'payments') {
    const current = safeJson(project.modules_json, []);
    const modules = Array.from(new Set([...(Array.isArray(current) ? current : []), 'payments']));
    const editUrl = new URL(req.url);
    editUrl.pathname = '/api/projects/' + encodeURIComponent(project.id) + '/modules';
    editUrl.search = '';
    const edited = await editModulesRoute(new Request(editUrl.toString(), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-admin-secret': req.headers.get('x-admin-secret') || '' },
      body: JSON.stringify({ modules }),
    }), env, editUrl);
    if (!edited) return json({ ok: false, error: 'Module editor unavailable.' }, 500);
    const data = await commandResponseData(edited);
    if (!edited.ok) return json(data, edited.status);
    return json({ ok: true, command: 'payments', kind: 'action', message: Array.isArray(current) && current.includes('payments') ? 'Payments is already enabled for ' + project.name + '.' : 'Payments added to ' + project.name + '; build plan regenerated.', data });
  }

  const projectPath = '/api/projects/' + encodeURIComponent(project.id);
  if (definition.name === 'plan') {
    const response = await commandSecureRequest(req, env, projectPath + '/plan');
    const data = await commandResponseData(response);
    if (!response.ok) return json(data, response.status);
    return json({ ok: true, command: 'plan', kind: 'action', message: project.name + ' build plan generated.', data });
  }
  if (definition.name === 'generate') {
    const response = await commandSecureRequest(req, env, projectPath + '/generate');
    const data = await commandResponseData(response);
    if (!response.ok) return json(data, response.status);
    return json({ ok: true, command: 'generate', kind: 'action', message: project.name + ' repository-ready package generated.', data });
  }
  if (definition.name === 'validate') {
    const response = await commandSecureRequest(req, env, projectPath + '/validate-generated');
    const committed = await commitValidatedBundle(req, env, project.id, response);
    const data = await commandResponseData(committed);
    if (!committed.ok) return json(data, committed.status);
    return json({ ok: true, command: 'validate', kind: 'action', message: project.name + ' passed validation and was committed to the IZAKHONO internal repository.', preview: data.preview || null, data });
  }
  if (definition.name === 'launch') {
    const planned = await commandSecureRequest(req, env, projectPath + '/plan');
    const plannedData = await commandResponseData(planned);
    if (!planned.ok) return json({ ok: false, error: plannedData.error || 'Planning failed.', stage: 'plan' }, planned.status);
    const generated = await commandSecureRequest(req, env, projectPath + '/generate');
    const generatedData = await commandResponseData(generated);
    if (!generated.ok) return json({ ok: false, error: generatedData.error || 'Generation failed.', stage: 'generate' }, generated.status);
    const validated = await commandSecureRequest(req, env, projectPath + '/validate-generated');
    const committed = await commitValidatedBundle(req, env, project.id, validated);
    const validatedData = await commandResponseData(committed);
    if (!committed.ok) return json({ ok: false, error: validatedData.error || 'Validation or internal commit failed.', stage: 'validate' }, committed.status);
    return json({
      ok: true,
      command: 'launch',
      kind: 'action',
      message: project.name + ' completed plan → generate → validate → IZAKHONO internal commit. This is a technical proof, not a claim that public production hosting is verified.',
      preview: validatedData.preview || null,
      data: { project: { id: project.id, name: project.name, slug: project.slug }, generated: generatedData.generated || null, validation: validatedData.validation || null, internal_repository: validatedData.internal_repository || null },
    });
  }

  return json({ ok: false, error: 'Action /' + definition.name + ' has no executor.' }, 501);
}

async function commandCentrePage(req: Request, env: any, url: URL): Promise<Response | null> {
  if (url.pathname !== '/commands' && url.pathname !== '/commands/') return null;
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  const assetUrl = new URL(req.url);
  assetUrl.pathname = '/commands/index.html';
  assetUrl.search = '';
  const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), req));
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'same-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('content-security-policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  headers.delete('content-length');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}


const LEGACYMART_HOST = 'legacymart.izakhono.co.za';

async function publicLegacyMartHost(req: Request, env: any, url: URL): Promise<Response | null> {
  if (url.hostname !== LEGACYMART_HOST) return null;

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const cleanPath = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  const assetUrl = new URL(req.url);
  if (cleanPath === '/' || cleanPath === '/index.html') {
    assetUrl.pathname = '/legacymart/index.html';
  } else if (cleanPath === '/health' || cleanPath === '/health.json') {
    assetUrl.pathname = '/legacymart/health.json';
  } else {
    return Response.redirect('https://' + LEGACYMART_HOST + '/', 302);
  }
  assetUrl.search = '';

  const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), req));
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('x-izakhono-route', 'external-resilience-cloudflare');
  if ((response.headers.get('content-type') || '').includes('text/html')) {
    headers.set(
      'content-security-policy',
      "default-src 'self'; connect-src https://yfawrenhudjomhnglfhq.supabase.co; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'"
    );
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
  } else {
    headers.set('cache-control', 'no-store');
  }
  headers.delete('content-length');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}


const GROWTH_DIAGNOSTIC_OPTIONS = {
  revenue_band: new Set(['starting_under_50k','50k_250k','250k_1m','1m_plus','prefer_not']),
  goal: new Set(['customers','website_commerce','marketing','automation_ai','staffing','finance_admin','hosting_email','security_trust']),
  urgency: new Set(['now_30_days','1_3_months','exploring']),
  sales_process: new Set(['none','manual','repeatable','automated']),
  digital_foundation: new Set(['no_site','basic_site','active_site','integrated_stack']),
  buying_mode: new Set(['self_serve','guided','enterprise']),
};

const GROWTH_PRODUCT_MAP: Record<string,string[]> = {
  customers: ['izakhono-growth-engine','izakhono-ads','izakhono-crm'],
  website_commerce: ['izakhono-host','izakhono-builder','izakhono-growth-engine'],
  marketing: ['izakhono-growth-engine','izakhono-ads','izakhono-crm'],
  automation_ai: ['izakhono-flow','izakhono-flowiq','izakhono-business-ai'],
  staffing: ['izakhono-crm','izakhono-flow','izakhono-growth-engine'],
  finance_admin: ['izakhono-finance-core','izakhono-flow','izakhono-crm'],
  hosting_email: ['izakhono-host','izakhono-builder','izakhono-crm'],
  security_trust: ['izakhono-fortress','izakhono-host','izakhono-crm'],
};

const GROWTH_FOCUS: Record<string,string> = {
  customers: 'customer acquisition and conversion',
  website_commerce: 'website and digital conversion',
  marketing: 'marketing execution and demand generation',
  automation_ai: 'workflow automation and practical AI',
  staffing: 'people pipeline and operating workflow',
  finance_admin: 'finance, administration and workflow control',
  hosting_email: 'professional hosting, email and digital foundation',
  security_trust: 'security, fraud prevention and customer trust',
};

const growthRate = new Map<string, number[]>();

function growthClean(value: unknown, max = 500): string {
  return String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
}

function growthPick(value: unknown, key: keyof typeof GROWTH_DIAGNOSTIC_OPTIONS, fallback: string): string {
  const clean = growthClean(value, 80);
  return GROWTH_DIAGNOSTIC_OPTIONS[key].has(clean) ? clean : fallback;
}

function growthDiagnosticEdge(input: any = {}) {
  const revenue_band = growthPick(input.revenue_band, 'revenue_band', 'prefer_not');
  const goal = growthPick(input.goal, 'goal', 'customers');
  const urgency = growthPick(input.urgency, 'urgency', 'exploring');
  const sales_process = growthPick(input.sales_process, 'sales_process', 'manual');
  const digital_foundation = growthPick(input.digital_foundation, 'digital_foundation', 'basic_site');
  const buying_mode = growthPick(input.buying_mode, 'buying_mode', 'guided');

  const laneByRevenue: Record<string,string> = {
    starting_under_50k: 'FOUNDATION',
    '50k_250k': 'GROWTH',
    '250k_1m': 'SCALE',
    '1m_plus': 'ENTERPRISE',
    prefer_not: 'GROWTH',
  };
  const baseScore: Record<string,number> = {
    starting_under_50k: 20,
    '50k_250k': 40,
    '250k_1m': 60,
    '1m_plus': 80,
    prefer_not: 35,
  };
  let score = baseScore[revenue_band]
    + (urgency === 'now_30_days' ? 10 : urgency === '1_3_months' ? 5 : 0)
    + ((sales_process === 'none' || sales_process === 'manual') ? 5 : 0)
    + ((digital_foundation === 'no_site' || digital_foundation === 'basic_site') ? 5 : 0)
    + (buying_mode === 'enterprise' ? 5 : 0);
  score = Math.min(100, score);

  let lane = laneByRevenue[revenue_band];
  if (buying_mode === 'enterprise' && lane !== 'FOUNDATION') lane = 'ENTERPRISE';
  const focus = GROWTH_FOCUS[goal];
  const actions: Record<string,string[]> = {
    FOUNDATION: [
      'Establish the minimum professional digital foundation.',
      'Launch one measurable lead path with a clear offer and call to action.',
      'Capture every enquiry in CRM and follow up consistently.',
    ],
    GROWTH: [
      'Tighten the offer and conversion journey around one priority audience.',
      'Run a multi-channel campaign with owned lead capture and CRM handoff.',
      'Automate follow-up and measure enquiry-to-revenue conversion.',
    ],
    SCALE: [
      'Connect campaign, CRM and operating workflows so growth does not depend on manual handoffs.',
      'Use automation and AI where it removes repeat work or improves response speed.',
      'Track pipeline, conversion and revenue outcomes as one operating system.',
    ],
    ENTERPRISE: [
      'Design a governed enterprise pilot around a measurable commercial or operational outcome.',
      'Integrate CRM, automation, infrastructure and security controls through owned-first interfaces.',
      'Scale only after the pilot produces verified results and operational evidence.',
    ],
  };

  return {
    schema: 'izakhono.growth.diagnostic.v1',
    lane,
    lead_score: score,
    focus,
    summary: 'Your highest-value next move is to strengthen ' + focus + ' through a ' + lane.toLowerCase() + ' execution path.',
    answers: { revenue_band, goal, urgency, sales_process, digital_foundation, buying_mode },
    actions: actions[lane],
    recommended_products: GROWTH_PRODUCT_MAP[goal],
    next_steps: ['start_now','request_whatsapp','book_strategy','get_proposal'],
    privacy: { behavioural_tracking: false, advertising_ids: false, tracking_cookies: false },
    generated_at: new Date().toISOString(),
  };
}

function growthRateAllowed(req: Request): boolean {
  const ip = growthClean(req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown', 96);
  const now = Date.now(), windowMs = 60 * 60 * 1000;
  const active = (growthRate.get(ip) || []).filter(t => now - t < windowMs);
  if (active.length >= 20) { growthRate.set(ip, active); return false; }
  active.push(now);
  growthRate.set(ip, active);
  if (growthRate.size > 5000) growthRate.clear();
  return true;
}

async function ensureGrowthLeadTable(env: any) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS growth_diagnostic_leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    intent TEXT NOT NULL,
    lane TEXT NOT NULL,
    lead_score INTEGER NOT NULL,
    focus TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    recommended_products_json TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    consent INTEGER NOT NULL CHECK (consent = 1),
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

async function growthCheckRoute(req: Request, env: any, url: URL): Promise<Response | null> {
  if (url.pathname === '/growth-check') return Response.redirect(url.origin + '/growth-check/', 302);

  if (url.pathname === '/api/public/growth-diagnostic' && req.method === 'POST') {
    if (!growthRateAllowed(req)) return json({ error: 'too many requests' }, 429);
    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: 'Expected application/json' }, 400); }
    return json(growthDiagnosticEdge(body), 200);
  }

  if (url.pathname === '/api/public/growth-diagnostic/lead' && req.method === 'POST') {
    if (!growthRateAllowed(req)) return json({ error: 'too many requests' }, 429);
    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: 'Expected application/json' }, 400); }
    if (growthClean(body.website, 120)) return json({ ok: true }, 202);
    if (body.consent !== true) return json({ error: 'contact consent is required' }, 400);

    const email = growthClean(body.email, 200);
    const phone = growthClean(body.phone, 80);
    if (!email && !phone) return json({ error: 'email or phone is required' }, 400);

    const profile = growthDiagnosticEdge(body.answers || {});
    const intents = new Set(['start_now','request_whatsapp','book_strategy','get_proposal']);
    const requested = growthClean(body.intent, 80);
    const intent = intents.has(requested) ? requested : 'get_proposal';
    const id = 'gdl_' + crypto.randomUUID().replaceAll('-', '');

    await ensureGrowthLeadTable(env);
    await env.DB.prepare(`INSERT INTO growth_diagnostic_leads
      (id,name,company,email,phone,intent,lane,lead_score,focus,answers_json,recommended_products_json,message,consent,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,'queued')`)
      .bind(
        id,
        growthClean(body.name, 160),
        growthClean(body.company, 180),
        email,
        phone,
        intent,
        profile.lane,
        profile.lead_score,
        profile.focus,
        JSON.stringify(profile.answers),
        JSON.stringify(profile.recommended_products),
        growthClean(body.message, 900),
      ).run();

    return json({
      ok: true,
      id,
      status: 'queued',
      crm_status: 'queued',
      profile,
      next_gate: 'IZAKHONO CRM handoff',
    }, 201);
  }

  if (url.pathname === '/api/owner/growth-diagnostic/leads' && req.method === 'GET') {
    if (!(await ownerAuthorized(req, env))) return json({ ok: false, error: 'Unauthorized' }, 401);
    await ensureGrowthLeadTable(env);
    const rows = await env.DB.prepare(`SELECT id,name,company,email,phone,intent,lane,lead_score,focus,status,created_at
      FROM growth_diagnostic_leads
      ORDER BY lead_score DESC, created_at DESC
      LIMIT 250`).all<any>();
    return json({ ok: true, items: rows.results || [] });
  }

  if (url.pathname.startsWith('/growth-check/') && (req.method === 'GET' || req.method === 'HEAD')) {
    const relative = url.pathname.slice('/growth-check/'.length) || 'index.html';
    if (!new Set(['index.html','app.js','styles.css']).has(relative)) return new Response('Not found', { status: 404 });
    const assetUrl = new URL(req.url);
    assetUrl.pathname = '/growth-check/' + relative;
    assetUrl.search = '';
    const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), req));
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (relative === 'index.html') {
      headers.set('content-security-policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    }
    headers.delete('content-length');
    return new Response(req.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return null;
}


const AI_CORE_HOST = 'ai.izakhono.co.za';

async function publicAiCoreHost(req: Request, env: any, url: URL): Promise<Response | null> {
  if (url.hostname !== AI_CORE_HOST) return null;

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/owner-actions/')) {
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: {
        allow: 'GET, HEAD',
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  const cleanPath = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

  if (cleanPath === '/nav') {
    return Response.redirect('https://' + AI_CORE_HOST + '/nav/', 302);
  }

  if (url.pathname.startsWith('/nav/')) {
    const relative = url.pathname.slice('/nav/'.length) || 'index.html';
    const mapped = relative === 'health' ? 'health.json' : relative;
    const allowed = new Set(['index.html', 'manifest.webmanifest', 'sw.js', 'health.json']);
    if (!allowed.has(mapped)) {
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    const navAssetUrl = new URL(req.url);
    navAssetUrl.pathname = '/ai-core/nav/' + mapped;
    navAssetUrl.search = '';
    const navResponse = await env.ASSETS.fetch(new Request(navAssetUrl.toString(), req));
    const navHeaders = new Headers(navResponse.headers);
    navHeaders.set('x-content-type-options', 'nosniff');
    navHeaders.set('referrer-policy', 'strict-origin-when-cross-origin');
    navHeaders.set('permissions-policy', 'camera=(), geolocation=(self), microphone=(self)');
    navHeaders.set('x-izakhono-route', 'external-resilience-cloudflare');
    navHeaders.set('x-izakhono-product', 'IZAKHONO-NAV');
    navHeaders.set('x-izakhono-release', 'v0.8-resilience');
    navHeaders.set('cache-control', 'public, max-age=0, must-revalidate');
    if (mapped === 'sw.js') navHeaders.set('service-worker-allowed', '/nav/');
    if ((navResponse.headers.get('content-type') || '').includes('text/html')) {
      navHeaders.set(
        'content-security-policy',
        "default-src 'self'; connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; worker-src 'self'; manifest-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'"
      );
    }
    navHeaders.delete('content-length');
    return new Response(navResponse.body, {
      status: navResponse.status,
      statusText: navResponse.statusText,
      headers: navHeaders,
    });
  }

  const externalRoutes: Record<string, string> = {
    '/worknow': 'https://worknow-sa.vercel.app',
    '/faisready': 'https://faisready-revenue.vercel.app',
    '/mandatory-exams': 'https://mandatory-regulatory-exams.vercel.app',
    '/auto-ai': 'https://auto-ai-eosin.vercel.app',
    '/allegro': 'https://allegro-vibez.vercel.app',
    '/kora': 'https://kora-network.vercel.app',
    '/growth': 'https://izakhono-growth-os.vercel.app',
    '/revenue': 'https://izakhono-revenue-os.vercel.app',
  };
  if (externalRoutes[cleanPath]) {
    return Response.redirect(externalRoutes[cleanPath], 302);
  }

  const nativeRoutes: Record<string, string> = {
    '/super-accountant': '/ai-core/super-accountant/index.html',
    '/studio': '/ai-core/studio/index.html',
    '/edubuild': '/ai-core/edubuild/index.html',
    '/edubuild-info': '/ai-core/edubuild-info/index.html',
    '/doxa-sure': '/ai-core/doxa-sure/index.html',
  };

  const assetUrl = new URL(req.url);
  if (cleanPath === '/' || cleanPath === '/index.html') {
    assetUrl.pathname = '/ai-core/index.html';
  } else if (nativeRoutes[cleanPath]) {
    assetUrl.pathname = nativeRoutes[cleanPath];
  } else if (!url.pathname.startsWith('/ai-core/')) {
    return Response.redirect('https://' + AI_CORE_HOST + '/', 302);
  }

  const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), req));
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  if ((response.headers.get('content-type') || '').includes('text/html')) {
    headers.set(
      'content-security-policy',
      "default-src 'self'; connect-src 'self' https://yfawrenhudjomhnglfhq.supabase.co; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
    );
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
  }
  headers.delete('content-length');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const url = new URL(req.url);

    const developerApi = await developerApiRoute(req, env, url, () => ownerAuthorized(req, env));
    if (developerApi) return developerApi;

    if ((url.pathname === '/console' || url.pathname === '/console/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const assetUrl = new URL(req.url);
      assetUrl.pathname = '/developer-console/index.html';
      assetUrl.search = '';
      const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), req));
      const headers = new Headers(asset.headers);
      headers.set('cache-control', 'public, max-age=0, must-revalidate');
      headers.set('x-content-type-options', 'nosniff');
      headers.set('referrer-policy', 'strict-origin-when-cross-origin');
      headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
      headers.set('content-security-policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
      headers.delete('content-length');
      return new Response(req.method === 'HEAD' ? null : asset.body, { status: asset.status, statusText: asset.statusText, headers });
    }

    const commandsApi = await commandApiRoute(req, env, url);
    if (commandsApi) return commandsApi;

    const growthCheck = await growthCheckRoute(req, env, url);
    if (growthCheck) return growthCheck;

    const commandsPage = await commandCentrePage(req, env, url);
    if (commandsPage) return commandsPage;

    const legacyMart = await publicLegacyMartHost(req, env, url);
    if (legacyMart) return legacyMart;

    const publicAi = await publicAiCoreHost(req, env, url);
    if (publicAi) return publicAi;

    const ventureBuild = await ventureFactoryBuildRoute(req, env, url);
    if (ventureBuild) return ventureBuild;

    const buildAnything = await buildAnythingRoute(req, env, url);
    if (buildAnything) return buildAnything;

    const reviewLoop = await reviewLoopRoute(req, env, url);
    if (reviewLoop) return reviewLoop;

    const bidForge = await bidForgeRoute(req, env, url);
    if (bidForge) return bidForge;

    const venture = await ventureFactoryRoute(req, env, url, () => ownerAuthorized(req, env));
    if (venture) return venture;

    const repairPage = faisPaymentsRepairPage(url);
    if (repairPage && req.method === 'GET') return repairPage;

    const autopilot = await projectAutopilotRoute(req, env, url);
    if (autopilot) return autopilot;

    const repairApi = await faisPaymentsRepairApi(req, env, url);
    if (repairApi) return repairApi;

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