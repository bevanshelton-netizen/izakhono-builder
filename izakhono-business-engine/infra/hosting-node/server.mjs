import http from 'node:http';
import crypto from 'node:crypto';
import { registerNode, startHeartbeat } from './registration.mjs';

const port = Number(process.env.HOSTING_NODE_PORT || 8787);
const nodeId = process.env.IZAKHONO_NODE_ID || 'unregistered-node';
const releaseToken = process.env.IZAKHONO_RELEASE_TOKEN || '';
const publicBaseUrl = process.env.IZAKHONO_PUBLIC_BASE_URL || '';
let controlPlaneRegistered = false;
let lastControlPlaneError = null;

function send(res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
function readJson(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', chunk => { data += chunk; if (data.length > 1024 * 1024) reject(new Error('REQUEST_TOO_LARGE')); }); req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('INVALID_JSON')); } }); req.on('error', reject); }); }
const isReady = () => Boolean(releaseToken && publicBaseUrl && controlPlaneRegistered);

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, isReady() ? 200 : 503, { ok: isReady(), node_id: nodeId, service: 'izakhono-hosting-node', contract: 'izakhono.hosting.node.v1', ready_for_release: isReady(), public_base_url_configured: Boolean(publicBaseUrl), control_plane_registered: controlPlaneRegistered, last_control_plane_error: lastControlPlaneError, timestamp: new Date().toISOString() });
  if (req.method === 'POST' && req.url === '/v1/releases') {
    if (!releaseToken || req.headers.authorization !== `Bearer ${releaseToken}`) return send(res, 401, { ok: false, error: 'UNAUTHORIZED' });
    if (!isReady()) return send(res, 503, { ok: false, error: 'HOSTING_NODE_NOT_READY' });
    try { const body = await readJson(req); if (!body.artifact_url || !body.checksum || !body.version) return send(res, 400, { ok: false, error: 'ARTIFACT_URL_CHECKSUM_VERSION_REQUIRED' }); return send(res, 202, { ok: true, provider_request_id: `owned-${crypto.randomUUID()}`, node_id: nodeId, contract: 'izakhono.release.v1', execution_status: 'accepted', published_url: null }); }
    catch (error) { return send(res, 400, { ok: false, error: error instanceof Error ? error.message : 'REQUEST_FAILED' }); }
  }
  return send(res, 404, { ok: false, error: 'NOT_FOUND' });
});

server.listen(port, '0.0.0.0', async () => {
  try { await registerNode(); controlPlaneRegistered = true; lastControlPlaneError = null; }
  catch (error) { lastControlPlaneError = error instanceof Error ? error.message : 'REGISTRATION_FAILED'; }
  startHeartbeat(() => isReady());
  console.log(`IZAKHONO hosting node listening on ${port}`);
});
