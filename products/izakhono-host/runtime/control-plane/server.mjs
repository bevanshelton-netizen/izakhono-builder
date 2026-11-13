import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { PostgresProvisioningStore } from '../provisioner/postgres-provisioning-store.mjs';
import { PaidProvisioningBridge } from '../provisioner/payment-bridge.mjs';

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'sites.json');
const SITES_DIR = path.join(DATA_DIR, 'sites');
const ADMIN_TOKEN = process.env.HOST_RUNTIME_TOKEN || '';
const PAYMENT_BRIDGE_TOKEN = process.env.HOST_PAYMENT_BRIDGE_TOKEN || '';
let pool = null;
if (process.env.PGHOST) {
  const { Pool } = await import('pg');
  pool = new Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE || 'izakhono', user: process.env.PGUSER || 'izakhono', password: process.env.PGPASSWORD, max: 10, connectionTimeoutMillis: 5000 });
}
const paymentBridge = pool ? new PaidProvisioningBridge(new PostgresProvisioningStore(pool)) : null;
const MAX_FILES = 200;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

async function loadState() {
  await fs.mkdir(SITES_DIR, { recursive: true });
  try { return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')); }
  catch { return { version: 2, sites: [], deployments: [] }; }
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
function constantTimeTokenMatch(req, expected) {
  const supplied = String(req.headers['x-izakhono-payment-token'] || '');
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  return Boolean(expected) && a.length === b.length && crypto.timingSafeEqual(a, b);
}
function authorized(req) {
  if (!ADMIN_TOKEN) return false;
  return req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;
}
function id(prefix) { return `${prefix}_${crypto.randomUUID().replaceAll('-','')}`; }
function validDomain(domain) {
  return typeof domain === 'string' && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}
function safeDomain(domain) { return domain.toLowerCase().replace(/[^a-z0-9.-]/g, ''); }
function siteDir(domain) { return path.join(SITES_DIR, safeDomain(domain), 'public'); }
function safeRelative(filePath) {
  const value=String(filePath || '').replaceAll('\\','/').replace(/^\/+/, '');
  if (!value || value.includes('\0') || value.split('/').some(part => part === '..' || part === '.')) return null;
  return value;
}
function escapeHtml(value) { return String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }

async function ensureSiteFiles(site) {
  const dir = siteDir(site.domain);
  await fs.mkdir(dir, { recursive: true });
  const index = path.join(dir, 'index.html');
  try { await fs.access(index); }
  catch {
    const title = escapeHtml(site.domain);
    await fs.writeFile(index, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — IZAKHONO</title><meta name="generator" content="IZAKHONO Native Runtime"></head><body style="font-family:system-ui;margin:0;background:#0b1220;color:#fff"><main style="max-width:900px;margin:15vh auto;padding:32px"><p>IZAKHONO HOST</p><h1>${title}</h1><p>Your site has been provisioned on the IZAKHONO owned runtime.</p><p>Deployment ID: ${escapeHtml(site.id)}</p></main></body></html>`, 'utf8');
  }
}

async function findSite(hostname) {
  const host = String(hostname || '').split(':')[0].toLowerCase().replace(/^www\./, '');
  const state = await loadState();
  return state.sites.find(s => s.domain === host || `www.${s.domain}` === host) || null;
}

const MIME = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml'
};

async function serveSite(req, res) {
  const site = await findSite(req.headers.host);
  if (!site || site.public_live !== true) return json(res, 404, {ok:false,error:'Site is not publicly accepted on IZAKHONO HOST'});
  const base = siteDir(site.domain);
  const requested = decodeURIComponent(new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname);
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const file = path.resolve(base, relative);
  if (!file.startsWith(path.resolve(base) + path.sep)) return json(res, 400, {ok:false,error:'Invalid path'});
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) return json(res, 404, {ok:false,error:'Not found'});
    const data = await fs.readFile(file);
    res.writeHead(200, {'content-type':MIME[path.extname(file).toLowerCase()] || 'application/octet-stream','cache-control':'public, max-age=60'});
    return res.end(data);
  } catch { return json(res, 404, {ok:false,error:'Not found'}); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, {ok:true, service:'IZAKHONO HOST Runtime', version:'0.3.0', payment_store_configured:Boolean(pool)});
  if (req.method === 'GET' && url.pathname === '/ready') {
    if (!pool) return json(res, 503, {ok:false, ready:false, reason:'PostgreSQL is not configured'});
    try { await pool.query('SELECT 1'); return json(res, 200, {ok:true, ready:true}); }
    catch { return json(res, 503, {ok:false, ready:false, reason:'PostgreSQL unavailable'}); }
  }
  if (req.method === 'POST' && url.pathname === '/internal/payments/verified') {
    if (!paymentBridge || !constantTimeTokenMatch(req, PAYMENT_BRIDGE_TOKEN)) return json(res, 401, {ok:false,error:'Unauthorized payment bridge caller'});
    try {
      const input = await body(req);
      const accepted = await paymentBridge.acceptPaidPayment({ payment: input.payment, order: input.order });
      return json(res, accepted.created ? 201 : 200, {ok:true, created:accepted.created, provisioning_id:accepted.record.id, state:accepted.record.state});
    } catch (error) { return json(res, 409, {ok:false,error:error?.message || 'Verified payment was not accepted'}); }
  }
  if (req.method === 'GET' && url.pathname === '/api/tls/ask') {
    const site = await findSite(url.searchParams.get('domain') || '');
    return site ? json(res, 200, {ok:true,domain:site.domain}) : json(res, 403, {ok:false,error:'Domain is not provisioned'});
  }
  if (!url.pathname.startsWith('/api/')) return serveSite(req, res);
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
      if (existing) { await ensureSiteFiles(existing); return json(res,200,{ok:true,created:false,site:existing}); }
      const site={
        id:String(input.site_id || id('site')), domain, source_ref:String(input.source_ref||'internal'),
        runtime:'izakhono-native', status:'provisioned', created_at:new Date().toISOString(),
        public_live:false, acceptance:{https:false,content:true,dns:false,mail:false}
      };
      await ensureSiteFiles(site);
      state.sites.push(site);
      state.deployments.push({id:id('dep'),site_id:site.id,action:'provision',status:'verified',created_at:new Date().toISOString()});
      await saveState(state);
      return json(res,201,{ok:true,created:true,site});
    } catch (e) { return json(res,400,{ok:false,error:e?.message || 'Invalid request'}); }
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/sites\/[^/]+\/content$/)) {
    try {
      const siteId=url.pathname.split('/')[3];
      const input=await body(req);
      const files=Array.isArray(input.files) ? input.files : [];
      if (!files.length || files.length > MAX_FILES) return json(res,400,{ok:false,error:`files must contain 1-${MAX_FILES} entries`});
      const state=await loadState();
      const site=state.sites.find(s=>s.id===siteId);
      if(!site) return json(res,404,{ok:false,error:'Site not found'});
      const normalized=[];
      let total=0;
      for (const item of files) {
        const relative=safeRelative(item?.path);
        if (!relative) return json(res,400,{ok:false,error:'Invalid file path'});
        const content=String(item?.content ?? '');
        const bytes=Buffer.byteLength(content,'utf8');
        if (bytes > MAX_FILE_BYTES) return json(res,413,{ok:false,error:`File exceeds ${MAX_FILE_BYTES} bytes: ${relative}`});
        total += bytes;
        if (total > MAX_TOTAL_BYTES) return json(res,413,{ok:false,error:`Deployment exceeds ${MAX_TOTAL_BYTES} bytes`});
        normalized.push({path:relative,content});
      }
      const base=path.resolve(siteDir(site.domain));
      for (const item of normalized) {
        const target=path.resolve(base,item.path);
        if (!target.startsWith(base + path.sep)) return json(res,400,{ok:false,error:'Invalid deployment target'});
        await fs.mkdir(path.dirname(target),{recursive:true});
        await fs.writeFile(target,item.content,'utf8');
      }
      site.status='content_ready';
      site.public_live=false;
      site.acceptance={https:Boolean(site.acceptance?.https),dns:Boolean(site.acceptance?.dns),content:true,mail:Boolean(site.acceptance?.mail)};
      const deployment={id:id('dep'),site_id:site.id,action:'content',status:'verified',file_count:normalized.length,total_bytes:total,created_at:new Date().toISOString()};
      state.deployments.push(deployment);
      await saveState(state);
      return json(res,200,{ok:true,site,deployment});
    } catch (e) { return json(res,400,{ok:false,error:e?.message || 'Invalid deployment'}); }
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/sites\/[^/]+\/accept$/)) {
    const siteId=url.pathname.split('/')[3];
    const input=await body(req).catch(()=>({}));
    const state=await loadState();
    const site=state.sites.find(s=>s.id===siteId);
    if(!site) return json(res,404,{ok:false,error:'Site not found'});
    site.acceptance={https:Boolean(input.https), dns:Boolean(input.dns), content:Boolean(input.content), mail:Boolean(input.mail)};
    site.public_live=site.acceptance.https && site.acceptance.dns && site.acceptance.content && site.acceptance.mail;
    site.status=site.public_live?'live':'provisioned';
    site.accepted_at=new Date().toISOString();
    await saveState(state);
    return json(res,200,{ok:true,site});
  }

  return json(res,404,{ok:false,error:'Not found'});
});

if (pool) {
  const migration = await fs.readFile('/app/migrations/001_host_provisioning_records.sql', 'utf8');
  await pool.query(migration);
}

server.listen(PORT, '0.0.0.0', () => console.log(`IZAKHONO HOST Runtime listening on ${PORT}`));
