const base = process.env.NODE01_URL || 'http://127.0.0.1:8940';
const auth = process.env.NODE01_TOKEN ? { authorization: `Bearer ${process.env.NODE01_TOKEN}` } : {};

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...auth, ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${body.error || ''}`.trim());
  return body;
}

const health = await request('/health');
if (!health.ok || health.service !== 'NODE01-SW') throw new Error('invalid health response');

const workspaceName = `smoke-${Date.now()}`;
const workspace = await request('/v1/workspaces', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: workspaceName })
});

await request(`/v1/workspaces/${workspace.id}/files/index.txt`, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ content: 'IZAKHONO NODE01-SW smoke test' })
});

const job = await request('/v1/jobs', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'BUILD', workspace_id: workspace.id })
});

if (job.status !== 'COMPLETED' || job.result?.result !== 'passed') {
  throw new Error(`typed BUILD execution failed: ${JSON.stringify(job)}`);
}

console.log('NODE01-SW smoke OK', {
  service: health.service,
  version: health.version,
  workspace: workspace.id,
  job: job.id,
  status: job.status,
  provider: job.provider_id
});
