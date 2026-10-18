import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'sites.json');
const ADMIN_TOKEN = process.env.HOST_RUNTIME_TOKEN || '';

async function loadState() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')); }
  catch { return { version: 1, sites: [], deployments: [] }; }
}
async function saveState(state) {
  const tmp = STATE_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmp, STATE_FILE);
}
function json(res, status, value) {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(value));
}
async function body(req) {
  const chunks=[];
  for await (const chunk of req) chunks.push(chunk);
  const text=Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  return JSON.parse(text);
}
function authorized(req) {
  if (!ADMIN_TOKEN) return false;
  return req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;
}
function id(prefix) { return `${prefix}_${crypto.randomUUID().replaceAll('-','')}`; }
function validDomain(domain) {
  return typeof domain === 'string' && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, {ok:true, service:'IZAKHONO HOST Runtime', version:'0.2.0'});
  if (!authorized(req)) return json(res, 401, {ok:false,error:'Unauthorized'});

  if (req.method === 'GET' && url.pathname === '/api/sites') {
    const state=await loadState();
    return json(res, 200, {ok:true,sites:state.sites});
  }

  if (req.method === 'POST' && url.pathname === '/api/sites/provision') {
    try {
      const input=await body(req);
      const domain=String(input.domain || '').trim().toLowerCase();
      if (!validDomain(domain)) return json(res,400,{ok:false,error:'Invalid domain'});
      const state=await loadState();
      const existing=state.sites.find(s=>s.domain===domain);
      if (existing) return json(res,200,{ok:true,created:false,site:existing});
      const site={
        id:id('site'), domain, source_ref:String(input.source_ref||'internal'),
        runtime:'izakhono-native', status:'provisioned',
        created_at:new Date().toISOString(),
        public_live:false,
        acceptance:{https:false,content:false,dns:false}
      };
      state.sites.push(site);
      state.deployments.push({id:id('dep'),site_id:site.id,action:'provision',status:'verified',created_at:new Date().toISOString()});
      await saveState(state);
      return json(res,201,{ok:true,created:true,site});
    } catch (e) { return json(res,400,{ok:false,error:e?.message || 'Invalid request'}); }
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/sites\/[^/]+\/accept$/)) {
    const siteId=url.pathname.split('/')[3];
    const input=await body(req).catch(()=>({}));
    const state=await loadState();
    const site=state.sites.find(s=>s.id===siteId);
    if(!site) return json(res,404,{ok:false,error:'Site not found'});
    site.acceptance={
      https:Boolean(input.https), dns:Boolean(input.dns), content:Boolean(input.content)
    };
    site.public_live=site.acceptance.https && site.acceptance.dns && site.acceptance.content;
    site.status=site.public_live?'live':'provisioned';
    site.accepted_at=new Date().toISOString();
    await saveState(state);
    return json(res,200,{ok:true,site});
  }

  return json(res,404,{ok:false,error:'Not found'});
});

server.listen(PORT, '0.0.0.0', () => console.log(`IZAKHONO HOST Runtime listening on ${PORT}`));
