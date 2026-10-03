import secureApp from './secure';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function ownerAuthorized(req: Request, env: any): Promise<boolean> {
  const url = new URL(req.url);
  url.pathname = '/api/automation-capabilities';
  url.search = '';
  const probe = new Request(url.toString(), { method: 'GET', headers: req.headers });
  const response = await secureApp.fetch(probe, env);
  return response.ok;
}

function clean(value: unknown, max = 500): string {
  return String(value ?? '').trim().replace(/[\\u0000-\\u001f\\u007f]/g, ' ').slice(0, max);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function node01DeploymentEvidenceRoute(
  req: Request,
  env: any,
  url: URL,
): Promise<Response | null> {
  const match = url.pathname.match(/^\\/api\\/owner\\/deployments\\/([^/]+)\\/accept$/);
  if (!match) return null;
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (!(await ownerAuthorized(req, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Expected application/json' }, 400); }

  const appId = decodeURIComponent(match[1]);
  const app = await env.DB.prepare(
    'SELECT app_id,developer_id,name,stage,builder_project_id,deployment_json FROM builder_app_registry WHERE app_id=?'
  ).bind(appId).first<any>();
  if (!app) return json({ ok: false, error: 'App not found' }, 404);
  if (!app.builder_project_id) return json({ ok: false, error: 'Builder project link missing' }, 409);

  const project = await env.DB.prepare(
    'SELECT id,status,build_recipe_json FROM builder_projects WHERE id=?'
  ).bind(app.builder_project_id).first<any>();
  if (!project) return json({ ok: false, error: 'Builder project not found' }, 409);

  const recipe = JSON.parse(project.build_recipe_json || '{}');
  const candidate = recipe.release_candidate;
  if (!candidate?.revision || !candidate?.internal_repository_head) {
    return json({ ok: false, error: 'Release candidate is missing or incomplete' }, 409);
  }

  const deploymentId = clean(body.deployment_id, 160);
  const revision = clean(body.revision, 200);
  const internalHead = clean(body.internal_repository_head, 200);
  const runtimeUrl = clean(body.runtime_url, 500);
  const httpStatus = Number(body.http_status);
  const tlsVerified = body.tls_verified === true;
  const dnsVerified = body.dns_verified === true;
  const rollbackVerified = body.rollback_verified === true;

  if (!deploymentId || !revision || !internalHead || !runtimeUrl) {
    return json({ ok: false, error: 'deployment_id, revision, internal_repository_head and runtime_url are required' }, 400);
  }
  if (revision !== candidate.revision || internalHead !== candidate.internal_repository_head) {
    return json({
      ok: false,
      error: 'Evidence does not match the exact release candidate',
      expected: { revision: candidate.revision, internal_repository_head: candidate.internal_repository_head },
    }, 409);
  }
  if (!/^https:\\/\\/[^\\s]+$/i.test(runtimeUrl)) {
    return json({ ok: false, error: 'runtime_url must be HTTPS' }, 400);
  }
  if (httpStatus !== 200 || !tlsVerified || !dnsVerified || !rollbackVerified) {
    return json({
      ok: false,
      error: 'NODE01 acceptance gates are incomplete',
      required: { http_status: 200, tls_verified: true, dns_verified: true, rollback_verified: true },
    }, 422);
  }

  const evidence = {
    schema: 'izakhono.deployment-evidence/v2',
    deployment_id: deploymentId,
    app_id: appId,
    developer_id: app.developer_id,
    project_id: project.id,
    revision,
    internal_repository_head: internalHead,
    runtime_url: runtimeUrl,
    http_status: httpStatus,
    tls_verified: tlsVerified,
    dns_verified: dnsVerified,
    rollback_verified: rollbackVerified,
    accepted_at: new Date().toISOString(),
  };
  const canonical = JSON.stringify(evidence);
  const evidenceHash = await sha256(canonical);

  const existing = await env.DB.prepare(
    'SELECT deployment_id,status,evidence_hash FROM builder_deployment_evidence WHERE deployment_id=?'
  ).bind(deploymentId).first<any>();
  if (existing) {
    if (existing.evidence_hash === evidenceHash && existing.status === 'accepted') {
      return json({ ok: true, idempotent: true, deployment: { ...evidence, evidence_hash: evidenceHash, deployment_verified: true, rollback_ready: true, public_live: true } });
    }
    return json({ ok: false, error: 'deployment_id has already been used' }, 409);
  }

  await env.DB.prepare(
    'INSERT INTO builder_deployment_evidence(deployment_id,app_id,developer_id,project_id,revision,internal_repository_head,runtime_url,http_status,tls_verified,dns_verified,rollback_verified,evidence_hash,evidence_json,status,verified_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)'
  ).bind(
    deploymentId, appId, app.developer_id, project.id, revision, internalHead, runtimeUrl, httpStatus,
    1, 1, 1, evidenceHash, canonical, 'accepted',
  ).run();

  const deployment = {
    ...evidence,
    evidence_hash: evidenceHash,
    status: 'deployment_verified',
    deployment_verified: true,
    rollback_ready: true,
    public_live: true,
    authority: 'NODE01/CODE/RUNTIME/EDGE-TLS/DNS',
    source_of_truth: 'izakhono-internal',
  };

  const updatedRecipe = {
    ...recipe,
    release_candidate: { ...candidate, status: 'deployed', public_live: true, deployed_at: evidence.accepted_at },
  };

  await env.DB.batch([
    env.DB.prepare("UPDATE builder_projects SET status='deployed',build_recipe_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(JSON.stringify(updatedRecipe), project.id),
    env.DB.prepare("UPDATE builder_app_registry SET stage='deployed',deployment_json=?,updated_at=CURRENT_TIMESTAMP WHERE app_id=?")
      .bind(JSON.stringify(deployment), appId),
    env.DB.prepare('INSERT INTO builder_events(id,project_id,event_type,detail) VALUES(?,?,?,?)')
      .bind('evt_' + crypto.randomUUID().replaceAll('-', ''), project.id, 'developer_factory.deployment_verified', JSON.stringify(deployment)),
  ]);

  return json({
    ok: true,
    app: { app_id: appId, stage: 'deployed' },
    builder_project: { id: project.id, status: 'deployed' },
    deployment,
    next_gate: 'production-payment-and-growth-configuration',
    public_live: true,
  });
}
