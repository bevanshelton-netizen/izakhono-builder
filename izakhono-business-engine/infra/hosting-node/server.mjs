import http from 'node:http';
import crypto from 'node:crypto';
import { executeRelease, getReleaseProxyTarget, getReleaseStatus } from './executor.mjs';
import { registerNode, startHeartbeat } from './registration.mjs';

const port = Number(process.env.HOSTING_NODE_PORT || 8787);
const nodeId = process.env.IZAKHONO_NODE_ID || 'unregistered-node';
const releaseToken = process.env.IZAKHONO_RELEASE_TOKEN || '';
const publicBaseUrl = process.env.IZAKHONO_PUBLIC_BASE_URL || '';
let controlPlaneRegistered = false;
let lastControlPlaneError = null;

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) reject(new Error('REQUEST_TOO_LARGE'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('INVALID_JSON')); }
    });
    req.on('error', reject);
  });
}
const isReady = () => Boolean(releaseToken && publicBaseUrl && controlPlaneRegistered);

async function proxyRelease(req, res, releaseId, suffix) {
  try {
    const target = await getReleaseProxyTarget(releaseId);
    if (!target) return send(res, 404, { ok: false, error: 'RELEASE_NOT_PUBLISHED' });
    const upstream = http.request({ hostname: target.host, port: target.port, path: suffix || '/', method: req.method, headers: { ...req.headers, host: `${target.host}:${target.port}` } }, upstreamRes => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) send(res, 502, { ok: false, error: 'RELEASE_UPSTREAM_UNAVAILABLE' }); else res.destroy(); });
    req.pipe(upstream);
  } catch (error) {
    return send(res, 500, { ok: false, error: error instanceof Error ? error.message : 'PROXY_FAILED' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const releaseMatch = url.pathname.match(/^\/releases\/([A-Za-z0-9._-]{1,120})(\/.*)?$/);
  if (releaseMatch && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') return proxyRelease(req, res, releaseMatch[1], `${releaseMatch[2] || '/'}${url.search}`);
  if (releaseMatch && (req.method === 'GET' || req.method === 'HEAD')) return proxyRelease(req, res, releaseMatch[1], `${releaseMatch[2] || '/'}${url.search}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    const ready = isReady();
    return send(res, ready ? 200 : 503, { ok: ready, node_id: nodeId, service: 'izakhono-hosting-node', contract: 'izakhono.hosting.node.v1', ready_for_release: ready, public_base_url_configured: Boolean(publicBaseUrl), control_plane_registered: controlPlaneRegistered, last_control_plane_error: lastControlPlaneError, timestamp: new Date().toISOString() });
  }

  if (req.method === 'POST' && url.pathname === '/v1/releases') {
    if (!releaseToken || req.headers.authorization !== `Bearer ${releaseToken}`) return send(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    if (!isReady()) return send(res, 503, { ok: false, error: 'HOSTING_NODE_NOT_READY' });
    try {
      const body = await readJson(req);
      if (!body.artifact_url || !body.checksum || !body.version) return send(res, 400, { ok: false, error: 'ARTIFACT_URL_CHECKSUM_VERSION_REQUIRED' });
      const providerRequestId = `owned-${crypto.randomUUID()}`;
      void executeRelease({ ...body, provider_request_id: providerRequestId, release_queue_id: body.release_queue_id || null }).catch(() => {});
      return send(res, 202, { ok: true, provider_request_id: providerRequestId, node_id: nodeId, contract: 'izakhono.release.v1', execution_status: 'accepted', published_url: null, status_url: `${publicBaseUrl.replace(/\/$/, '')}/v1/releases/${encodeURIComponent(providerRequestId)}` });
    } catch (error) {
      return send(res, 400, { ok: false, error: error instanceof Error ? error.message : 'REQUEST_FAILED' });
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/v1/releases/')) {
    const id = url.pathname.slice('/v1/releases/'.length);
    try { return send(res, 200, { ok: true, ...(await getReleaseStatus(id)) }); }
    catch (error) { return send(res, 400, { ok: false, error: error instanceof Error ? error.message : 'STATUS_FAILED' }); }
  }

  return send(res, 404, { ok: false, error: 'NOT_FOUND' });
});

server.listen(port, '0.0.0.0', async () => {
  try { await registerNode(); controlPlaneRegistered = true; lastControlPlaneError = null; }
  catch (error) { lastControlPlaneError = error instanceof Error ? error.message : 'REGISTRATION_FAILED'; }
  startHeartbeat(() => isReady());
  console.log(`IZAKHONO hosting node listening on ${port}`);
});
