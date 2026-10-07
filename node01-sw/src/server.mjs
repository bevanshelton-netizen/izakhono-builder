import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8940);
const DATA_DIR = process.env.NODE01_DATA_DIR || path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const TOKEN = process.env.NODE01_TOKEN || '';
const NODE_ID = process.env.NODE_ID || `NODE01-SW-${os.hostname()}`;

const state = { workspaces: [], jobs: [] };

async function loadState() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    Object.assign(state, JSON.parse(raw));
  } catch {
    await persist();
  }
}

async function persist() {
  const tmp = `${STATE_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2));
  const { rename } = await import('node:fs/promises');
  await rename(tmp, STATE_FILE);
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  if (raw.length > 1024 * 1024) throw new Error('payload too large');
  return JSON.parse(raw);
}

function capabilities() {
  return {
    code: true,
    workspaces: true,
    jobs: true,
    build: true,
    run: false,
    deploy: false,
    provisioner: false,
    arbitrary_shell: false,
    executor: 'isolated-adapter-required'
  };
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/health') {
    return json(res, 200, { ok: true, node_id: NODE_ID, service: 'NODE01-SW', version: '0.2.0' });
  }

  if (pathname.startsWith('/v1/') && !authorized(req)) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (req.method === 'GET' && pathname === '/v1/node') {
    return json(res, 200, { node_id: NODE_ID, hostname: os.hostname(), platform: process.platform, arch: process.arch, uptime_s: Math.floor(process.uptime()), capabilities: capabilities() });
  }

  if (req.method === 'GET' && pathname === '/v1/capabilities') {
    return json(res, 200, capabilities());
  }

  if (req.method === 'GET' && pathname === '/v1/workspaces') {
    return json(res, 200, { workspaces: state.workspaces });
  }

  if (req.method === 'POST' && pathname === '/v1/workspaces') {
    const input = await body(req);
    const name = String(input.name || '').trim();
    if (!/^[a-zA-Z0-9._-]{1,80}$/.test(name)) return json(res, 400, { error: 'invalid workspace name' });
    const workspace = { id: randomUUID(), name, status: 'READY', created_at: new Date().toISOString() };
    state.workspaces.push(workspace);
    await persist();
    return json(res, 201, workspace);
  }

  if (req.method === 'POST' && pathname === '/v1/jobs') {
    const input = await body(req);
    const type = String(input.type || '').toUpperCase();
    const allowed = new Set(['BUILD', 'TEST', 'RUN', 'DEPLOY', 'PROVISION']);
    if (!allowed.has(type)) return json(res, 400, { error: 'unsupported job type', allowed: [...allowed] });
    const job = {
      id: randomUUID(),
      type,
      workspace_id: input.workspace_id || null,
      status: type === 'RUN' || type === 'DEPLOY' || type === 'PROVISION' ? 'QUEUED' : 'QUEUED',
      payload: input.payload || {},
      created_at: new Date().toISOString()
    };
    state.jobs.push(job);
    await persist();
    return json(res, 202, job);
  }

  const match = pathname.match(/^\/v1\/jobs\/([^/]+)$/);
  if (req.method === 'GET' && match) {
    const job = state.jobs.find((item) => item.id === match[1]);
    return job ? json(res, 200, job) : json(res, 404, { error: 'job not found' });
  }

  return json(res, 404, { error: 'not found' });
}

await loadState();
const server = createServer((req, res) => {
  route(req, res).catch((err) => json(res, 400, { error: err.message || 'request failed' }));
});
server.listen(PORT, '0.0.0.0', () => console.log(`IZAKHONO NODE01-SW listening on :${PORT}`));
