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
async function healthPayload() {
  const dependencies = await dependencyHealth();
  return {
    ok: true,
    ready: dependencies.routing.ready && dependencies.search.ready,
    product: config.product,
    version: config.version,
    releaseId: config.releaseId,
    runtimeId: config.runtimeId,
    runtimeClass: config.runtimeClass,
    node01Required: false,
    routing: dependencies.routing.ready ? 'ready' : 'unavailable',
    search: dependencies.search.ready ? 'ready' : 'unavailable',
    tiles: dependencies.tiles.ready ? 'ready' : 'unavailable',
    dependencies,
    privacy: { analytics:false, adIdentifiers:false, behaviouralTracking:false, rawQueryLogging:false }
  };
}
async function routeResponse(start, end, profile) {
  const result = await routeRequest(start, end, profile);
  if (result.error) return json({ ok:false, ...result }, result.status || 503);
  return json(result);
}
async function searchResponse(q, limit, lat, lng, compat=false) {
  const result = await searchRequest(q, limit, lat, lng);
  if (result.error) return json({ ok:false, ...result }, result.status || 503);
  return compat ? json(result.results) : json({ ok:true, ...result });
}
async function tileResponse(z,x,y) {
  const target = tileTarget(z,x,y);
  if (!target) return json({ ok:false, error:'tiles_unavailable' }, 503);
  const upstream = await fetch(target.url, { headers:{'user-agent':'IZAKHONO-NAV-ENGINE/1.1'} });
  if (!upstream.ok) return json({ ok:false, error:'tile_upstream_failed', status:upstream.status }, 502);
  const body = Buffer.from(await upstream.arrayBuffer());
  return { status:200, body, headers:{ 'content-type':upstream.headers.get('content-type') || 'application/octet-stream', 'cache-control':'public, max-age=86400', 'x-izakhono-tile-source':target.source } };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, { status:204, body:'' }, req);
    if (!['GET','HEAD'].includes(req.method || '')) return send(res, json({ok:false,error:'method_not_allowed'},405,{allow:'GET, HEAD, OPTIONS'}), req);
    if (!rateAllowed(clientId(req))) return send(res, json({ok:false,error:'rate_limited'},429,{'retry-after':'60'}), req);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/' || path === '/v1') return send(res, json({ok:true,product:config.product,version:config.version,endpoints:['/health','/api/health','/v1/runtime','/api/search','/api/route/{mode}/{coords}','/tiles/{z}/{x}/{y}.png']}), req);

    if (path === '/health' || path === '/v1/health' || path === '/api/health') {
      const h = await healthPayload();
      return send(res, json(h, h.ready ? 200 : 207), req);
    }
    if (path === '/v1/runtime') return send(res, json({
      ok:true, releaseId:config.releaseId, runtimeId:config.runtimeId, runtimeClass:config.runtimeClass,
      node01Required:false, resilienceAllowed:config.resilienceAllowed,
      capabilities:{routing:Boolean(config.routing.url || (config.resilienceAllowed && config.routing.resilienceUrl)),search:Boolean(config.search.url || (config.resilienceAllowed && config.search.resilienceUrl)),tiles:Boolean(config.tiles.template || (config.resilienceAllowed && config.tiles.resilienceTemplate))}
    }), req);

    if (path === '/v1/search' || path === '/api/search') {
      const q=(url.searchParams.get('q')||'').trim();
      if(q.length<2||q.length>200) return send(res,json({ok:false,error:'invalid_query'},400),req);
      const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));
      return send(res, await searchResponse(q,url.searchParams.get('limit')||5,Number.isFinite(lat)?lat:null,Number.isFinite(lng)?lng:null,path==='/api/search'), req);
    }

    if (path === '/v1/route') {
      const start=parsePoint(url.searchParams.get('start')),end=parsePoint(url.searchParams.get('end'));
      const profile=url.searchParams.get('profile')||'driving';
      if(!start||!end) return send(res,json({ok:false,error:'invalid_coordinates',expected:'start=lng,lat&end=lng,lat'},400),req);
      if(!['driving','walking','cycling','truck'].includes(profile)) return send(res,json({ok:false,error:'invalid_profile'},400),req);
      return send(res,await routeResponse(start,end,profile),req);
    }

    const compatRoute=path.match(/^\/api\/route\/(driving|walking|cycling|truck)\/([^;]+);([^/]+)$/);
    if(compatRoute){
      const start=parsePoint(compatRoute[2]),end=parsePoint(compatRoute[3]);
      if(!start||!end) return send(res,json({ok:false,error:'invalid_coordinates'},400),req);
      return send(res,await routeResponse(start,end,compatRoute[1]),req);
    }

    if(path==='/tiles/health'){
      const h=await healthPayload();
      return send(res,json({ok:true,ready:h.tiles==='ready',tiles:h.tiles,runtimeId:h.runtimeId,releaseId:h.releaseId},h.tiles==='ready'?200:503),req);
    }

    const tileMatch=path.match(/^\/tiles\/(\d+)\/(\d+)\/(\d+)\.png$/)||path.match(/^\/v1\/tiles\/(\d+)\/(\d+)\/(\d+)$/);
    if(tileMatch){
      const [z,x,y]=tileMatch.slice(1).map(Number);
      if(z<0||z>22) return send(res,json({ok:false,error:'invalid_tile'},400),req);
      return send(res,await tileResponse(z,x,y),req);
    }

    return send(res,json({ok:false,error:'not_found'},404),req);
  } catch(error){
    const status=Number(error?.status)>=400&&Number(error?.status)<=599?Number(error.status):502;
    return send(res,json({ok:false,error:'engine_request_failed',status,detail:String(error?.message||error).slice(0,240)},status),req);
  }
});
server.listen(config.port,config.host,()=>process.stdout.write(`[IZAKHONO NAV ENGINE] ${config.releaseId} listening on ${config.host}:${config.port} runtime=${config.runtimeId}\n`));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
