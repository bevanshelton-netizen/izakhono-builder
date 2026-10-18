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
const forward = async (req,res) => {
  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise((resolve,reject)=>{ const chunks=[]; for(const c of []) chunks.push(c); req.on('data',c=>chunks.push(c)); req.on('end',()=>resolve(Buffer.concat(chunks))); req.on('error',reject); });
    const upstream = await fetch(internalBase + req.url, { method:req.method, headers:{accept:req.headers.accept || '*/*','content-type':req.headers['content-type'] || 'application/json'}, body:body?.length ? body : undefined, signal:AbortSignal.timeout(5000) });
    const data = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, Object.fromEntries([...upstream.headers.entries()].filter(([k])=>!['connection','transfer-encoding'].includes(k.toLowerCase()))));
    res.end(data);
  } catch { json(res,502,{ok:false,error:'owned_runtime_unreachable'}); }
};

const server = http.createServer(async (req,res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const headers = req.headers;
  const input = req.method === 'GET' ? {} : await readJson(req);
  if (input && input.ok === false) return json(res,input.status,{ok:false,error:input.error});
  let result = null;
  if (url.pathname === '/api/nodes' && req.method === 'GET') {
    result = await control.listReady();
    return json(res,result.ok ? 200 : 503,result);
  }
  const match = url.pathname.match(/^\/api\/nodes\/([^/]+)$/);
  if (match && req.method === 'GET') return json(res,401,{ok:false,error:'node_detail_requires_control_route'});
  if (url.pathname === '/api/nodes/register' && req.method === 'POST') result = await control.register(headers,input.value);
  else if (url.pathname.endsWith('/heartbeat') && req.method === 'POST') { const node_id=decodeURIComponent(url.pathname.split('/')[3] || ''); result = await control.heartbeat(headers,{...input.value,node_id}); }
  else if (url.pathname.endsWith('/workload') && req.method === 'POST') { const node_id=decodeURIComponent(url.pathname.split('/')[3] || ''); result = await control.authorizeWorkload(headers,{...input.value,node_id}); }
  else if (url.pathname.endsWith('/deploy') && req.method === 'POST') { const node_id=decodeURIComponent(url.pathname.split('/')[3] || ''); result = await control.recordDeployment(headers,{...input.value,node_id}); }
  else if (url.pathname.endsWith('/drain') && req.method === 'POST') { const node_id=decodeURIComponent(url.pathname.split('/')[3] || ''); result = await control.drain(headers,{...input.value,node_id}); }
  else return forward(req,res);
  return json(res,result.ok ? 200 : (result.status || 500),result);
});

server.listen(publicPort,host,()=>console.log(`IZAKHONO_ONE_GATEWAY=READY HOST=${host} PORT=${publicPort}`));
