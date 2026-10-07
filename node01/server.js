import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const HOST = process.env.NODE01_HOST || '127.0.0.1';
const PORT = Number(process.env.NODE01_PORT || 8940);
const ROOT = path.resolve(process.env.NODE01_ROOT || './node01-data');
const WORKSPACES = path.join(ROOT, 'workspaces');
const JOBS = new Map();
const startedAt = Date.now();

await fs.mkdir(WORKSPACES, { recursive: true });

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(data);
}

function nodeStatus() {
  const load = os.loadavg();
  return {
    node: 'NODE01-SW',
    version: '0.1.0',
    mode: 'software-defined',
    status: 'ready',
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    host: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    cpu_count: os.cpus().length,
    memory_total_bytes: os.totalmem(),
    memory_free_bytes: os.freemem(),
    load_average: load,
    workspace_root: WORKSPACES,
    runtime: 'nodejs',
    adapters: {
      local_process: true,
      docker: false,
      remote: false
    }
  };
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function createWorkspace(name = 'project') {
  const safe = String(name).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) || 'project';
  const id = `${safe}-${crypto.randomBytes(4).toString('hex')}`;
  const dir = path.join(WORKSPACES, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'NODE01_WORKSPACE.json'), JSON.stringify({ id, created_at: new Date().toISOString() }, null, 2));
  return { id, path: dir };
}

async function runJob(payload) {
  const id = crypto.randomUUID();
  const job = { id, type: payload.type || 'build', status: 'queued', created_at: new Date().toISOString() };
  JOBS.set(id, job);
  setImmediate(async () => {
    job.status = 'running';
    job.started_at = new Date().toISOString();
    try {
      // Deliberately no arbitrary shell execution in v0.1.
      // Execution adapters will be added behind explicit policy controls.
      if (payload.type === 'workspace') {
        job.result = await createWorkspace(payload.name);
      } else {
        job.result = { message: 'Job accepted by NODE01-SW', next: 'attach a reviewed runtime adapter' };
      }
      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
    }
    job.finished_at = new Date().toISOString();
  });
  return job;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || HOST}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, ...nodeStatus() });
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/node') {
      return json(res, 200, nodeStatus());
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/jobs') {
      return json(res, 200, { jobs: [...JOBS.values()] });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/v1/jobs/')) {
      const id = url.pathname.split('/').pop();
      const job = JOBS.get(id);
      return job ? json(res, 200, job) : json(res, 404, { error: 'job_not_found' });
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/jobs') {
      const payload = await body(req);
      return json(res, 202, await runJob(payload));
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/workspaces') {
      const payload = await body(req);
      return json(res, 201, await createWorkspace(payload.name));
    }

    if (req.method === 'GET' && url.pathname === '/api/v1/workspaces') {
      const entries = await fs.readdir(WORKSPACES, { withFileTypes: true });
      return json(res, 200, { workspaces: entries.filter(e => e.isDirectory()).map(e => e.name) });
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    return json(res, 500, { error: 'internal_error', message: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`NODE01-SW listening on http://${HOST}:${PORT}`);
});
