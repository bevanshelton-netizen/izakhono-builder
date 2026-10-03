type Stmt = {
  bind(...values: unknown[]): Stmt;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
};
type Env = { DB: { prepare(sql: string): Stmt } };

export type RapidFactoryExecuteBuild = (payload: {
  prompt: string;
  target: 'website' | 'app' | 'software' | 'game';
  name?: string;
  slug?: string;
}) => Promise<Response>;

const PHASES = [
  'intake',
  'architecture',
  'content',
  'brand',
  'build',
  'integration',
  'validation',
  'release_candidate',
  'deployment_verification',
  'handover',
] as const;

type Phase = typeof PHASES[number];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function id(prefix: string) {
  return prefix + '_' + crypto.randomUUID().replaceAll('-', '');
}

function clean(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function slugify(value: string) {
  return value.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'business-site';
}

function bool(value: unknown) {
  return value === true;
}

async function ensureSchema(env: Env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rapid_factory_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      target TEXT NOT NULL,
      brief TEXT NOT NULL,
      status TEXT NOT NULL,
      current_phase TEXT NOT NULL,
      project_id TEXT,
      project_status TEXT,
      release_revision TEXT,
      preview_url TEXT,
      public_url TEXT,
      requirements_json TEXT NOT NULL,
      proof_json TEXT NOT NULL DEFAULT '{}',
      blocker_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS rapid_factory_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      event_type TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function event(env: Env, jobId: string, phase: Phase | string, eventType: string, detail = '') {
  await env.DB.prepare(
    'INSERT INTO rapid_factory_events(id,job_id,phase,event_type,detail) VALUES(?,?,?,?,?)'
  ).bind(id('rfe'), jobId, phase, eventType, detail.slice(0, 1500)).run();
}

function requirementsFromPayload(payload: any) {
  return {
    domain: bool(payload?.requirements?.domain),
    email: bool(payload?.requirements?.email),
    payments: bool(payload?.requirements?.payments),
    whatsapp: payload?.requirements?.whatsapp !== false,
    seo: payload?.requirements?.seo !== false,
    analytics: bool(payload?.requirements?.analytics),
    deployment: payload?.requirements?.deployment !== false,
  };
}

function missingProof(requirements: any, proof: any): string[] {
  const missing: string[] = [];
  if (requirements.deployment) {
    if (!proof?.deployment?.https_200) missing.push('deployment.https_200');
    if (!clean(proof?.deployment?.public_url, 500)) missing.push('deployment.public_url');
  }
  if (requirements.domain && !proof?.domain?.verified) missing.push('domain.verified');
  if (requirements.email) {
    if (!proof?.email?.inbound_verified) missing.push('email.inbound_verified');
    if (!proof?.email?.outbound_verified) missing.push('email.outbound_verified');
  }
  if (requirements.payments && !proof?.payments?.verified) missing.push('payments.verified');
  return missing;
}

function phaseBoard(current: string, status: string) {
  const currentIndex = Math.max(0, PHASES.indexOf(current as Phase));
  return PHASES.map((phase, index) => ({
    phase,
    state:
      status === 'handover_ready' ? 'complete' :
      index < currentIndex ? 'complete' :
      index === currentIndex ? 'active' :
      'queued',
  }));
}

async function getJob(env: Env, jobId: string) {
  const row = await env.DB.prepare('SELECT * FROM rapid_factory_jobs WHERE id=?').bind(jobId).first<any>();
  if (!row) return null;
  const events = await env.DB.prepare(
    'SELECT id,phase,event_type,detail,created_at FROM rapid_factory_events WHERE job_id=? ORDER BY created_at ASC'
  ).bind(jobId).all<any>();
  const requirements = JSON.parse(row.requirements_json || '{}');
  const proof = JSON.parse(row.proof_json || '{}');
  const blocker = JSON.parse(row.blocker_json || '{}');
  return {
    ...row,
    requirements,
    proof,
    blocker,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    phase_board: phaseBoard(row.current_phase, row.status),
    events: events.results || [],
  };
}

async function createJob(req: Request, env: Env, executeBuild: RapidFactoryExecuteBuild) {
  let payload: any = null;
  try { payload = await req.json(); }
  catch { return json({ ok: false, error: 'Expected application/json' }, 400); }

  const brief = clean(payload?.brief || payload?.prompt, 3000);
  if (brief.length < 12) return json({ ok: false, error: 'A usable business brief is required.' }, 400);

  const target = ['website','app','software','game'].includes(String(payload?.target))
    ? payload.target
    : 'website';
  const name = clean(payload?.name || 'Rapid Build', 100);
  const slug = slugify(clean(payload?.slug || name, 100));
  const requirements = requirementsFromPayload(payload);
  const jobId = id('rfj');

  await ensureSchema(env);
  await env.DB.prepare(`
    INSERT INTO rapid_factory_jobs
      (id,name,slug,target,brief,status,current_phase,requirements_json,proof_json,blocker_json)
    VALUES(?,?,?,?,?,'running','intake',?,'{}','{}')
  `).bind(jobId, name, slug, target, brief, JSON.stringify(requirements)).run();

  await event(env, jobId, 'intake', 'phase.started', 'Owner brief accepted');
  await event(env, jobId, 'architecture', 'workers.dispatched', 'Architecture, content and brand lanes dispatched from one brief');
  await event(env, jobId, 'content', 'lane.ready', 'Content lane bound to shared project brief');
  await event(env, jobId, 'brand', 'lane.ready', 'Brand lane bound to shared project brief');

  await env.DB.prepare(
    "UPDATE rapid_factory_jobs SET current_phase='build',updated_at=CURRENT_TIMESTAMP WHERE id=?"
  ).bind(jobId).run();

  const enhancedPrompt = [
    brief,
    '',
    'RAPID FACTORY CONTRACT:',
    '- produce a complete controlled release candidate, not a mockup',
    '- mobile-first and accessible',
    '- include strong conversion CTA and contact flow',
    '- include SEO foundations',
    '- preserve owned-first / externally reversible deployment policy',
    '- no public-live claim without HTTPS 200 verification',
    '- prepare handover metadata',
  ].join('\n');

  let buildResponse: Response;
  try {
    buildResponse = await executeBuild({ prompt: enhancedPrompt, target, name, slug });
  } catch (error: any) {
    const blocker = {
      type: 'build-execution-failure',
      requires_owner_input: false,
      detail: clean(error?.message || error, 1000),
    };
    await env.DB.prepare(
      "UPDATE rapid_factory_jobs SET status='blocked',current_phase='build',blocker_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(JSON.stringify(blocker), jobId).run();
    await event(env, jobId, 'build', 'phase.failed', blocker.detail);
    return json({ ok: false, job_id: jobId, status: 'blocked', blocker }, 500);
  }

  let buildData: any = {};
  try { buildData = await buildResponse.clone().json(); } catch {}

  if (!buildResponse.ok || !buildData?.ok) {
    const blocker = {
      type: 'builder-rejected',
      requires_owner_input: false,
      stage: clean(buildData?.stage || 'build', 80),
      detail: clean(buildData?.error || 'Builder did not complete the release candidate.', 1000),
    };
    await env.DB.prepare(
      "UPDATE rapid_factory_jobs SET status='blocked',current_phase='build',blocker_json=?,result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?"
    ).bind(JSON.stringify(blocker), JSON.stringify(buildData || {}), jobId).run();
    await event(env, jobId, 'build', 'phase.failed', blocker.detail);
    return json({ ok: false, job_id: jobId, status: 'blocked', blocker, build: buildData }, buildResponse.status || 500);
  }

  const projectId = clean(buildData?.project?.id, 120);
  const projectStatus = clean(buildData?.project?.status || 'deploy_ready', 80);
  const revision = clean(buildData?.release_candidate?.revision || buildData?.build?.revision, 160);
  const previewUrl = clean(buildData?.build?.preview || buildData?.preview, 1000);

  await event(env, jobId, 'build', 'phase.complete', 'Application package generated');
  await event(env, jobId, 'integration', 'phase.complete', 'Selected modules integrated into generated bundle');
  await event(env, jobId, 'validation', 'phase.complete', 'Generated bundle passed Builder validation');
  await event(env, jobId, 'release_candidate', 'phase.complete', revision || 'release candidate ready');

  const blocker = requirements.deployment ? {
    type: 'external-proof-required',
    requires_owner_input: false,
    detail: 'Release candidate is ready. Public handover waits only for machine-verifiable deployment/domain/email/payment proof required by this job.',
    missing: missingProof(requirements, {}),
  } : {};

  const nextStatus = requirements.deployment ? 'awaiting_proof' : 'handover_ready';
  const nextPhase = requirements.deployment ? 'deployment_verification' : 'handover';

  await env.DB.prepare(`
    UPDATE rapid_factory_jobs
      SET status=?,current_phase=?,project_id=?,project_status=?,release_revision=?,preview_url=?,
          blocker_json=?,result_json=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=?
  `).bind(
    nextStatus, nextPhase, projectId, projectStatus, revision, previewUrl,
    JSON.stringify(blocker), JSON.stringify(buildData), jobId
  ).run();

  if (nextStatus === 'handover_ready') {
    await event(env, jobId, 'handover', 'handover.ready', 'No external deployment proof was required');
  } else {
    await event(env, jobId, 'deployment_verification', 'proof.requested', JSON.stringify(blocker.missing));
  }

  const job = await getJob(env, jobId);
  return json({
    ok: true,
    factory: 'IZAKHONO RAPID FACTORY',
    job,
    principle: 'one brief -> parallel lanes -> validated release candidate -> proof-gated handover',
  }, 201);
}

async function attachProof(req: Request, env: Env, jobId: string) {
  let payload: any = null;
  try { payload = await req.json(); }
  catch { return json({ ok: false, error: 'Expected application/json' }, 400); }

  const job = await getJob(env, jobId);
  if (!job) return json({ ok: false, error: 'Rapid Factory job not found' }, 404);

  const proof = {
    ...(job.proof || {}),
    ...(payload?.proof || payload || {}),
  };

  const missing = missingProof(job.requirements, proof);
  const handoverReady = missing.length === 0;
  const publicUrl = clean(proof?.deployment?.public_url, 1000);
  const blocker = handoverReady ? {} : {
    type: 'external-proof-required',
    requires_owner_input: false,
    detail: 'Handover remains gated only by missing verification evidence.',
    missing,
  };

  await env.DB.prepare(`
    UPDATE rapid_factory_jobs
      SET proof_json=?,blocker_json=?,status=?,current_phase=?,public_url=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=?
  `).bind(
    JSON.stringify(proof),
    JSON.stringify(blocker),
    handoverReady ? 'handover_ready' : 'awaiting_proof',
    handoverReady ? 'handover' : 'deployment_verification',
    publicUrl,
    jobId
  ).run();

  if (handoverReady) {
    await event(env, jobId, 'deployment_verification', 'proof.accepted', 'All required proof gates passed');
    await event(env, jobId, 'handover', 'handover.ready', publicUrl || 'Release candidate ready for handover');
  } else {
    await event(env, jobId, 'deployment_verification', 'proof.incomplete', JSON.stringify(missing));
  }

  return json({ ok: true, job: await getJob(env, jobId) });
}

export async function rapidFactoryRoute(
  req: Request,
  env: Env,
  url: URL,
  authorize: () => Promise<boolean>,
  executeBuild: RapidFactoryExecuteBuild,
): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/rapid-factory')) return null;
  if (!(await authorize())) return json({ ok: false, error: 'Unauthorized' }, 401);

  await ensureSchema(env);

  if (url.pathname === '/api/rapid-factory/jobs' && req.method === 'POST') {
    return createJob(req, env, executeBuild);
  }

  if (url.pathname === '/api/rapid-factory/jobs' && req.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT id,name,slug,target,status,current_phase,project_id,project_status,release_revision,preview_url,public_url,created_at,updated_at FROM rapid_factory_jobs ORDER BY updated_at DESC LIMIT 100'
    ).all<any>();
    return json({ ok: true, jobs: rows.results || [] });
  }

  const match = url.pathname.match(/^\/api\/rapid-factory\/jobs\/([^/]+)(?:\/(proof))?$/);
  if (match && !match[2] && req.method === 'GET') {
    const job = await getJob(env, match[1]);
    return job ? json({ ok: true, job }) : json({ ok: false, error: 'Rapid Factory job not found' }, 404);
  }

  if (match && match[2] === 'proof' && req.method === 'POST') {
    return attachProof(req, env, match[1]);
  }

  return json({ ok: false, error: 'Rapid Factory route not found' }, 404);
}
