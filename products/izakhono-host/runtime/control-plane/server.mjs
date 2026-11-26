import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createNavWorkloadController } from './nav-workloads.mjs';
import { createHttpNavProvider } from './nav-provider-http.mjs';

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'sites.json');
const SITES_DIR = path.join(DATA_DIR, 'sites');
const ADMIN_TOKEN = process.env.HOST_RUNTIME_TOKEN || '';
if (!ADMIN_TOKEN) throw new Error('HOST_RUNTIME_TOKEN_REQUIRED');
const MAX_REQUEST_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 200;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const navProvider = process.env.HOST_NAV_PROVIDER_URL && process.env.HOST_NAV_PROVIDER_TOKEN
  ? createHttpNavProvider({ baseUrl: process.env.HOST_NAV_PROVIDER_URL, token: process.env.HOST_NAV_PROVIDER_TOKEN })
  : null;
const navWorkloads = createNavWorkloadController({ dataDir: path.join(DATA_DIR, 'nav-workloads'), provider: navProvider });

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
  let total=0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_REQUEST_BYTES) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  const text=Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  return JSON.parse(text);
}
function authorized(req) {
  const provided = Buffer.from(String(req.headers.authorization || ''), 'utf8');
  const expected = Buffer.from(`Bearer ${ADMIN_TOKEN}`, 'utf8');
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
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
  if (!site) return json(res, 404, {ok:false,error:'Site not provisioned on IZAKHONO HOST'});
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
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, {ok:true, service:'IZAKHONO HOST Runtime', version:'0.3.0'});
  if (req.method === 'GET' && url.pathname === '/api/tls/ask') {
    const site = await findSite(url.searchParams.get('domain') || '');
    return site ? json(res, 200, {ok:true,domain:site.domain}) : json(res, 403, {ok:false,error:'Domain is not provisioned'});
  }
  if (!url.pathname.startsWith('/api/')) return serveSite(req, res);
  if (!authorized(req)) return json(res, 401, {ok:false,error:'Unauthorized'});
  try {
    if (await navWorkloads.handle(req, res, url, body, json)) return;
  } catch {
    return json(res, 500, { ok: false, error: 'HOST_NAV_WORKLOAD_INTERNAL_ERROR' });
  }

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
        public_live:false, acceptance:{https:false,content:true,dns:false}
      };
      await ensureSiteFiles(site);
      state.sites.push(site);
      state.deployments.push({id:id('dep'),site_id:site.id,action:'provision',status:'verified',created_at:new Date().toISOString()});
      await saveState(state);
      return json(res,201,{ok:true,created:true,site});
    } catch (e) { return json(res,e?.statusCode || 400,{ok:false,error:e?.message || 'Invalid request'}); }
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
      site.acceptance={https:Boolean(site.acceptance?.https),dns:Boolean(site.acceptance?.dns),content:true};
      const deployment={id:id('dep'),site_id:site.id,action:'content',status:'verified',file_count:normalized.length,total_bytes:total,created_at:new Date().toISOString()};
      state.deployments.push(deployment);
      await saveState(state);
      return json(res,200,{ok:true,site,deployment});
    } catch (e) { return json(res,e?.statusCode || 400,{ok:false,error:e?.message || 'Invalid deployment'}); }
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/sites\/[^/]+\/accept$/)) {
    const siteId=url.pathname.split('/')[3];
    let input;
    try { input=await body(req); }
    catch (error) { return json(res,error?.statusCode || 400,{ok:false,error:error?.message || 'Invalid acceptance evidence'}); }
    const state=await loadState();
    const site=state.sites.find(s=>s.id===siteId);
    if(!site) return json(res,404,{ok:false,error:'Site not found'});
    const required=['https','dns','content'];
    const evidence=input?.evidence && typeof input.evidence === 'object' ? input.evidence : {};
    const acceptedEvidence={};
    for (const kind of required) {
      const item=evidence[kind] || {};
      const evidenceId=String(item.evidence_id || '').trim();
      const observedAt=String(item.observed_at || '');
      const observedMs=Date.parse(observedAt);
      const ageMs=Date.now()-observedMs;
      acceptedEvidence[kind]={
        verified:item.verified === true && evidenceId.length > 0 && evidenceId.length <= 256
          && Number.isFinite(observedMs) && ageMs >= -60000 && ageMs <= 24*60*60*1000,
        evidence_id:evidenceId.slice(0,256),
        observed_at:observedAt
      };
    }
    site.acceptance=acceptedEvidence;
    site.public_live=required.every(kind=>acceptedEvidence[kind].verified);
    site.status=site.public_live?'live':'provisioned';
    site.accepted_at=site.public_live?new Date().toISOString():null;
    await saveState(state);
    if (!site.public_live) return json(res,409,{ok:false,error:'acceptance_evidence_incomplete',site});
    return json(res,200,{ok:true,site});
  }

  return json(res,404,{ok:false,error:'Not found'});
});

server.listen(PORT, '0.0.0.0', () => console.log(`IZAKHONO HOST Runtime listening on ${PORT}`));
