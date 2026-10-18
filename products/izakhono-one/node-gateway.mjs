import http from 'node:http';
import { createNodeControlApi } from './services/node-control-api.mjs';

const internalPort = Number(process.env.PORT || 8781);
const publicPort = Number(process.env.PUBLIC_PORT || internalPort);
const internalHost = String(process.env.INTERNAL_HOST || '127.0.0.1').trim() || '127.0.0.1';
const host = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';
const internalBase = `http://${internalHost}:${internalPort}`;
const controlToken = String(process.env.IZAKHONO_CONTROL_TOKEN || '').trim();
const nodeTokens = String(process.env.IZAKHONO_NODE_TOKENS_JSON || '').trim();
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!controlToken || !nodeTokens || !supabaseUrl || !supabaseKey) {
  console.error('IZAKHONO_ONE_START_BLOCKED=NODE_CONTROL_CREDENTIALS_OR_DATABASE_MISSING');
  process.exit(78);
}

await import('./server.mjs');
const { control } = createNodeControlApi({ url: supabaseUrl, key: supabaseKey, schema: process.env.SUPABASE_SCHEMA || 'one', controlToken, nodeTokens });

const json = (res, status, body) => {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(body));
};
const readJson = async req => {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size += chunk.length; if (size > 65536) return {ok:false,status:413,error:'payload_too_large'}; chunks.push(chunk); }
  try { return {ok:true,value:JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')}; } catch { return {ok:false,status:400,error:'invalid_json'}; }
};
const controlAuth = headers => String(headers.authorization || '').trim() === `Bearer ${controlToken}`;
const forward = async (req,res) => {
  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise((resolve,reject)=>{ const chunks=[]; req.on('data',c=>chunks.push(c)); req.on('end',()=>resolve(Buffer.concat(chunks))); req.on('error',reject); });
    const upstream = await fetch(internalBase + req.url, { method:req.method, headers:{accept:req.headers.accept || '*/*','content-type':req.headers['content-type'] || 'application/json'}, body:body?.length ? body : undefined, signal:AbortSignal.timeout(5000) });
    const data = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, Object.fromEntries([...upstream.headers.entries()].filter(([k])=>!['connection','transfer-encoding'].includes(k.toLowerCase()))));
    res.end(data);
  } catch { json(res,502,{ok:false,error:'owned_runtime_unreachable'}); }
};

const server = http.createServer(async (req,res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const headers = req.headers;
  const isNodeRoute = url.pathname === '/api/nodes' || url.pathname.startsWith('/api/nodes/');
  if (!isNodeRoute) return forward(req,res);
  if (!controlAuth(headers) && !url.pathname.endsWith('/heartbeat')) return json(res,401,{ok:false,error:'control_authentication_required'});
  if (url.pathname === '/api/nodes' && req.method === 'GET') {
    const result = await control.listReady();
    return json(res,result.ok ? 200 : 503,result);
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const nodeId = parts[2] ? decodeURIComponent(parts[2]) : '';
  const action = parts[3] || '';
  if (!nodeId || !action) return json(res,404,{ok:false,error:'node_route_not_found'});
  const parsed = await readJson(req);
  if (!parsed.ok) return json(res,parsed.status,{ok:false,error:parsed.error});
  const value = {...parsed.value,node_id:nodeId};
  let result;
  if (action === 'heartbeat' && req.method === 'POST') result = await control.heartbeat(headers,value);
  else if (action === 'workload' && req.method === 'POST') result = await control.authorizeWorkload(headers,value);
  else if (action === 'deploy' && req.method === 'POST') result = await control.recordDeployment(headers,value);
  else if (action === 'drain' && req.method === 'POST') result = await control.drain(headers,value);
  else return json(res,404,{ok:false,error:'node_route_not_found'});
  return json(res,result.ok ? 200 : (result.status || 500),result);
});

server.listen(publicPort,host,()=>console.log(`IZAKHONO_ONE_GATEWAY=READY HOST=${host} PORT=${publicPort}`));
