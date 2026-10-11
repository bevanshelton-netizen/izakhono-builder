import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const PORT = Number(process.env.PORT || 8090);
const NODE_ID = process.env.NODE_ID || 'NODE01';
const ADMIN_TOKEN = process.env.NODE01_ADMIN_TOKEN || '';
const ALLOWED_PREFIX = process.env.ALLOWED_IMAGE_PREFIX || 'ghcr.io/bevanshelton-netizen/';

let active = null;

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  if (!ADMIN_TOKEN) return process.env.NODE01_ALLOW_UNAUTH === 'true';
  return req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 65536) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function docker(args, timeout = 120000) {
  const result = await exec('docker', args, { timeout, maxBuffer: 1024 * 1024 });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

async function deploy(image, name = 'izakhono-super-seo', port = 8097, health = '/health') {
  if (typeof image !== 'string' || !image.startsWith(ALLOWED_PREFIX)) throw new Error('image_not_allowed');
  if (!/^ghcr\.io\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/.test(image)) throw new Error('invalid_image_reference');
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(name)) throw new Error('invalid_container_name');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid_port');

  await docker(['pull', image]);
  await docker(['rm', '-f', name]).catch(() => {});
  await docker(['run', '-d', '--name', name, '--restart', 'unless-stopped', '-p', `${port}:${port}`, image]);

  active = { node: NODE_ID, image, container: name, port, health, deployedAt: new Date().toISOString() };
  return active;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, node: NODE_ID, service: 'izakhono-node01-runtime', time: new Date().toISOString(), active });
    }
    if (req.method === 'GET' && req.url === '/status') {
      return json(res, 200, { ok: true, node: NODE_ID, active });
    }
    if (req.method === 'POST' && req.url === '/deploy') {
      if (!authorized(req)) return json(res, 401, { ok: false, error: 'unauthorized' });
      const input = await body(req);
      const result = await deploy(input.image, input.name, input.port, input.health || '/health');
      return json(res, 200, { ok: true, result });
    }
    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    return json(res, 400, { ok: false, error: error?.message || 'runtime_error' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`NODE01 runtime listening on ${PORT}`));
