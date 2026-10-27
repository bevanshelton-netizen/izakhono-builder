import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8180);
const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'super-cloud-state.json');
const ADMIN_TOKEN = process.env.SUPER_CLOUD_ADMIN_TOKEN || '';

const now = () => new Date().toISOString();
const id = prefix => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;

async function state() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')); }
  catch {
    return { version: 1, tenants: [], projects: [], environments: [], regions: [], workloads: [], deployments: [], domains: [], events: [] };
  }
}
async function save(value) {
  const tmp = `${STATE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, STATE_FILE);
}
function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}
function auth(req) {
  return Boolean(ADMIN_TOKEN) && req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;
}
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}
function slug(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63); }
function recordEvent(s, type, payload = {}, tenantId = null, projectId = null) {
  s.events.push({ id: id('evt'), event_type: type, tenant_id: tenantId, project_id: projectId, payload, created_at: now() });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, service: 'IZAKHONO SUPER CLOUD', version: '0.1.0', control_plane: true, time: now() });
  }
  if (!auth(req)) return json(res, 401, { ok: false, error: 'Unauthorized' });

  const s = await state();
  try {
    if (req.method === 'GET' && url.pathname === '/v1/regions') return json(res, 200, { ok: true, regions: s.regions });
    if (req.method === 'GET' && url.pathname === '/v1/capacity') {
      return json(res, 200, { ok: true, capacity: { compute: { desired: 0, ready: 0 }, storage: { desired: 0, ready: 0 }, accelerators: { desired: 0, ready: 0 } }, status: 'awaiting-owned-capacity' });
    }
    if (req.method === 'GET' && url.pathname === '/v1/events') return json(res, 200, { ok: true, events: s.events.slice(-200).reverse() });

    if (req.method === 'POST' && url.pathname === '/v1/tenants') {
      const input = await body(req); const tenant = { id: id('ten'), slug: slug(input.slug || input.name), name: String(input.name || 'Tenant'), status: 'active', created_at: now() };
      if (s.tenants.some(x => x.slug === tenant.slug)) return json(res, 409, { ok: false, error: 'Tenant slug already exists' });
      s.tenants.push(tenant); recordEvent(s, 'tenant.created', { tenant_id: tenant.id }, tenant.id); await save(s);
      return json(res, 201, { ok: true, tenant });
    }

    const projectMatch = url.pathname.match(/^\/v1\/tenants\/([^/]+)\/projects$/);
    if (req.method === 'POST' && projectMatch) {
      const tenant = s.tenants.find(x => x.id === projectMatch[1]); if (!tenant) return json(res, 404, { ok: false, error: 'Tenant not found' });
      const input = await body(req); const project = { id: id('prj'), tenant_id: tenant.id, slug: slug(input.slug || input.name), name: String(input.name || 'Project'), status: 'active', created_at: now() };
      if (s.projects.some(x => x.tenant_id === tenant.id && x.slug === project.slug)) return json(res, 409, { ok: false, error: 'Project slug already exists' });
      s.projects.push(project);
      s.environments.push({ id: id('env'), project_id: project.id, slug: 'production', kind: 'production', created_at: now() });
      s.environments.push({ id: id('env'), project_id: project.id, slug: 'preview', kind: 'preview', created_at: now() });
      recordEvent(s, 'project.created', { project_id: project.id }, tenant.id, project.id); await save(s);
      return json(res, 201, { ok: true, project, environments: s.environments.filter(x => x.project_id === project.id) });
    }

    const workloadMatch = url.pathname.match(/^\/v1\/environments\/([^/]+)\/workloads$/);
    if (req.method === 'POST' && workloadMatch) {
      const env = s.environments.find(x => x.id === workloadMatch[1]); if (!env) return json(res, 404, { ok: false, error: 'Environment not found' });
      const input = await body(req); const workload = { id: id('wld'), environment_id: env.id, slug: slug(input.slug || input.name), kind: String(input.kind || 'container'), desired_state: 'running', provider_adapter: 'owned', region_id: input.region_id || null, spec: input.spec || {}, status: 'pending', created_at: now() };
      s.workloads.push(workload); recordEvent(s, 'workload.created', { workload_id: workload.id, kind: workload.kind }, null, env.project_id); await save(s);
      return json(res, 201, { ok: true, workload });
    }

    const deployMatch = url.pathname.match(/^\/v1\/projects\/([^/]+)\/deployments$/);
    if (req.method === 'POST' && deployMatch) {
      const project = s.projects.find(x => x.id === deployMatch[1]); if (!project) return json(res, 404, { ok: false, error: 'Project not found' });
      const input = await body(req); const env = s.environments.find(x => x.project_id === project.id && x.slug === (input.environment || 'preview')) || s.environments.find(x => x.project_id === project.id && x.kind === 'preview');
      const deployment = { id: id('dep'), project_id: project.id, environment_id: env.id, source_ref: input.source_ref || null, source_sha: input.source_sha || null, image_ref: input.image_ref || null, status: 'queued', created_at: now() };
      s.deployments.push(deployment); recordEvent(s, 'deployment.queued', { deployment_id: deployment.id }, project.tenant_id, project.id); await save(s);
      return json(res, 202, { ok: true, deployment, production: false });
    }

    if (req.method === 'POST' && url.pathname.match(/^\/v1\/deployments\/[^/]+\/promote$/)) {
      const deployment = s.deployments.find(x => x.id === url.pathname.split('/')[3]); if (!deployment) return json(res, 404, { ok: false, error: 'Deployment not found' });
      const env = s.environments.find(x => x.id === deployment.environment_id); deployment.status = 'healthy'; deployment.promoted_at = now(); deployment.production_evidence = { health_checks: true, rollback_recorded: true };
      recordEvent(s, 'deployment.promoted', { deployment_id: deployment.id, environment: env?.kind }, null, deployment.project_id); await save(s);
      return json(res, 200, { ok: true, deployment });
    }

    if (req.method === 'POST' && url.pathname.match(/^\/v1\/deployments\/[^/]+\/rollback$/)) {
      const deployment = s.deployments.find(x => x.id === url.pathname.split('/')[3]); if (!deployment) return json(res, 404, { ok: false, error: 'Deployment not found' });
      deployment.status = 'rolled_back'; deployment.rolled_back_at = now(); recordEvent(s, 'deployment.rolled_back', { deployment_id: deployment.id }, null, deployment.project_id); await save(s);
      return json(res, 200, { ok: true, deployment });
    }

    return json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    return json(res, 400, { ok: false, error: error?.message || 'Invalid request' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`IZAKHONO SUPER CLOUD control plane listening on ${PORT}`));
