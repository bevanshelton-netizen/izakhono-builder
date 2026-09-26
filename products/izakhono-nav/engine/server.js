import http from 'node:http';
import { config } from './config.js';
import { json, parsePoint, clientId, rateAllowed, routeRequest, searchRequest, tileTarget, dependencyHealth } from './lib.js';

function cors(req) {
  const origin = req.headers.origin;
  if (!origin) return {};
  if (!config.allowedOrigins.length || config.allowedOrigins.includes(origin)) {
    return { 'access-control-allow-origin': origin, 'vary': 'origin', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': 'content-type' };
  }
  return {};
}

function securityHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'x-izakhono-product': 'IZAKHONO-NAV-ENGINE',
    'x-izakhono-release': config.releaseId,
    'x-izakhono-runtime': config.runtimeId,
  };
}

function send(res, out, req) {
  const headers = { ...securityHeaders(), ...cors(req), ...(out.headers || {}) };
  res.writeHead(out.status || 200, headers);
  if (req.method === 'HEAD') return res.end();
  res.end(out.body ?? '');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, { status: 204, body: '' }, req);
    if (!['GET','HEAD'].includes(req.method || '')) return send(res, json({ ok:false, error:'method_not_allowed' }, 405, { allow:'GET, HEAD, OPTIONS' }), req);
    if (!rateAllowed(clientId(req))) return send(res, json({ ok:false, error:'rate_limited' }, 429, { 'retry-after':'60' }), req);

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/' || path === '/v1') return send(res, json({ ok:true, product:config.product, version:config.version, endpoints:['/health','/v1/runtime','/v1/search','/v1/route','/v1/tiles/{z}/{x}/{y}'] }), req);

    if (path === '/health' || path === '/v1/health') {
      const dependencies = await dependencyHealth();
      const coreReady = dependencies.routing.ready && dependencies.search.ready;
      return send(res, json({ ok:true, ready:coreReady, product:config.product, version:config.version, releaseId:config.releaseId, runtimeId:config.runtimeId, runtimeClass:config.runtimeClass, node01Required:false, dependencies, privacy:{analytics:false, adIdentifiers:false, behaviouralTracking:false, rawQueryLogging:false} }, coreReady ? 200 : 207), req);
    }

    if (path === '/v1/runtime') return send(res, json({ ok:true, releaseId:config.releaseId, runtimeId:config.runtimeId, runtimeClass:config.runtimeClass, node01Required:false, resilienceAllowed:config.resilienceAllowed, capabilities:{routing:Boolean(config.routing.url || (config.resilienceAllowed && config.routing.resilienceUrl)), search:Boolean(config.search.url || (config.resilienceAllowed && config.search.resilienceUrl)), tiles:Boolean(config.tiles.template || (config.resilienceAllowed && config.tiles.resilienceTemplate))} }), req);

    if (path === '/v1/search') {
      const q = (url.searchParams.get('q') || '').trim();
      if (q.length < 2 || q.length > 200) return send(res, json({ ok:false, error:'invalid_query' }, 400), req);
      const lat = Number(url.searchParams.get('lat')); const lng = Number(url.searchParams.get('lng'));
      const result = await searchRequest(q, url.searchParams.get('limit') || 5, Number.isFinite(lat)?lat:null, Number.isFinite(lng)?lng:null);
      if (result.error) return send(res, json({ ok:false, ...result }, result.status || 503), req);
      return send(res, json({ ok:true, ...result }), req);
    }

    if (path === '/v1/route') {
      const start = parsePoint(url.searchParams.get('start')); const end = parsePoint(url.searchParams.get('end'));
      if (!start || !end) return send(res, json({ ok:false, error:'invalid_coordinates', expected:'start=lng,lat&end=lng,lat' }, 400), req);
      const profile = url.searchParams.get('profile') || 'driving';
      if (!['driving','walking','cycling','truck'].includes(profile)) return send(res, json({ ok:false, error:'invalid_profile' }, 400), req);
      const result = await routeRequest(start, end, profile);
      if (result.error) return send(res, json({ ok:false, ...result }, result.status || 503), req);
      return send(res, json({ ok:true, profile, ...result }), req);
    }

    const tileMatch = path.match(/^\/v1\/tiles\/(\d+)\/(\d+)\/(\d+)$/);
    if (tileMatch) {
      const [z,x,y] = tileMatch.slice(1).map(Number);
      if (z<0 || z>22) return send(res, json({ ok:false, error:'invalid_tile' }, 400), req);
      const target = tileTarget(z,x,y);
      if (!target) return send(res, json({ ok:false, error:'tiles_unavailable' }, 503), req);
      const upstream = await fetch(target.url, { headers:{'user-agent':'IZAKHONO-NAV-ENGINE/1.0'} });
      if (!upstream.ok) return send(res, json({ ok:false, error:'tile_upstream_failed', status:upstream.status }, 502), req);
      const body = Buffer.from(await upstream.arrayBuffer());
      return send(res, { status:200, body, headers:{ 'content-type':upstream.headers.get('content-type') || 'application/octet-stream', 'cache-control':'public, max-age=86400', 'x-izakhono-tile-source':target.source } }, req);
    }

    return send(res, json({ ok:false, error:'not_found' }, 404), req);
  } catch (error) {
    const status = Number(error?.status) >= 400 && Number(error?.status) <= 599 ? Number(error.status) : 502;
    return send(res, json({ ok:false, error:'engine_request_failed', status, detail:String(error?.message || error).slice(0,240) }, status), req);
  }
});

server.listen(config.port, config.host, () => {
  process.stdout.write(`[IZAKHONO NAV ENGINE] ${config.releaseId} listening on ${config.host}:${config.port} runtime=${config.runtimeId}\n`);
});

for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
