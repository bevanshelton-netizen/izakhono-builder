import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const pagePath = path.join(repoRoot, 'public', 'commands', 'index.html');

const host = process.env.IZAKHONO_BIND_HOST || '127.0.0.1';
const port = Number(process.env.IZAKHONO_COMMAND_PORT || 8091);
const localOrigin = (process.env.IZAKHONO_LOCAL_COMMAND_ORIGIN || 'http://127.0.0.1:8787').replace(/\/$/, '');
const externalOrigin = (process.env.IZAKHONO_EXTERNAL_COMMAND_ORIGIN || 'https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-commands').replace(/\/$/, '');

const safeHeaders = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...safeHeaders, ...headers });
  res.end(body);
}

function json(res, status, data) {
  send(res, status, JSON.stringify(data), { 'content-type': 'application/json; charset=utf-8' });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

async function checkOrigin(origin, local = false) {
  try {
    const target = local ? origin + '/api/health' : origin + '?api=health';
    const r = await fetchWithTimeout(target, { method: 'GET', headers: { accept: 'application/json' } }, 3000);
    return { reachable: r.ok, status: r.status };
  } catch (error) {
    return { reachable: false, status: 0, error: error?.name || 'unreachable' };
  }
}

function forwardHeaders(req, hasBody = false) {
  const headers = new Headers({ accept: 'application/json' });
  const secret = req.headers['x-admin-secret'];
  if (typeof secret === 'string' && secret) headers.set('x-admin-secret', secret);
  if (hasBody) headers.set('content-type', 'application/json');
  return headers;
}

async function proxyCommands(req, res, pathname) {
  const hasBody = req.method === 'POST';
  const body = hasBody ? await readBody(req) : undefined;
  const headers = forwardHeaders(req, hasBody);

  // 1) IZAKHONO-owned runtime on NODE01 / local network first.
  try {
    const localPath = pathname === '/api/commands/run' ? '/api/commands/run' : '/api/commands';
    const r = await fetchWithTimeout(localOrigin + localPath, { method: req.method, headers, body }, 5000);
    const text = await r.text();
    send(res, r.status, text, {
      'content-type': r.headers.get('content-type') || 'application/json; charset=utf-8',
      'x-izakhono-route': 'internal',
    });
    return;
  } catch {}

  // 2) External resilience route only when the internal runtime is unavailable.
  try {
    const target = pathname === '/api/commands/run' ? externalOrigin : externalOrigin + '?api=catalog';
    const r = await fetchWithTimeout(target, { method: req.method, headers, body }, 6500);
    const text = await r.text();
    send(res, r.status, text, {
      'content-type': r.headers.get('content-type') || 'application/json; charset=utf-8',
      'x-izakhono-route': 'external-resilience',
    });
    return;
  } catch {}

  json(res, 503, {
    ok: false,
    error: 'Both the IZAKHONO internal command runtime and the external resilience route are unavailable.',
    internal_origin: localOrigin,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://node01.local');
    const pathname = url.pathname;

    if (req.method === 'GET' && (pathname === '/' || pathname === '/commands' || pathname === '/commands/')) {
      const page = await fs.readFile(pagePath, 'utf8');
      send(res, 200, page, { 'content-type': 'text/html; charset=utf-8' });
      return;
    }

    if (req.method === 'GET' && (pathname === '/healthz' || pathname === '/api/health')) {
      const [internal, external] = await Promise.all([
        checkOrigin(localOrigin, true),
        checkOrigin(externalOrigin, false),
      ]);
      json(res, 200, {
        ok: true,
        node: 'IZAKHONO NODE01 command gateway',
        uptime_seconds: Math.floor(process.uptime()),
        internal,
        external_resilience: external,
        authority: 'internal-first',
      });
      return;
    }

    if ((req.method === 'GET' && pathname === '/api/commands') ||
        (req.method === 'POST' && pathname === '/api/commands/run')) {
      await proxyCommands(req, res, pathname);
      return;
    }

    json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    json(res, 500, { ok: false, error: 'NODE01 command gateway error' });
  }
});

server.listen(port, host, () => {
  console.log('[IZAKHONO NODE01] command gateway listening on http://' + host + ':' + port);
  console.log('[IZAKHONO NODE01] internal command origin: ' + localOrigin);
  console.log('[IZAKHONO NODE01] external resilience configured');
});
