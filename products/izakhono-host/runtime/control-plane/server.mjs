import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'sites.json');
const SITES_DIR = path.join(DATA_DIR, 'sites');
const ADMIN_TOKEN = process.env.HOST_RUNTIME_TOKEN || '';
const MAX_FILES = 200;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

async function loadState() {
  await fs.mkdir(SITES_DIR, { recursive: true });
  try {
    const parsed=JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
    return {
      version: 2,
      sites: Array.isArray(parsed.sites) ? parsed.sites : [],
      deployments: Array.isArray(parsed.deployments) ? parsed.deployments : []
    };
  } catch {
    return { version: 2, sites: [], deployments: [] };
  }
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
    if (total > MAX_REQUEST_BYTES) throw new Error('Request body exceeds 12 MiB');
    chunks.push(chunk);
  }
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
function safeDomain(domain) { return domain.toLowerCase().replace(/[^a-z0-9.-]/g, ''); }
function siteDir(domain) { return path.join(SITES_DIR, safeDomain(domain), 'public'); }
function safeRelative(filePath) {
  const value=String(filePath || '').replaceAll('\\','/').replace(/^\/+/, '');
  if (!value || value.includes('\0') || value.split('/').some(part => part === '..' || part === '.')) return null;
  return value;
}
function sensitiveDeploymentPath(relative) {
  const parts=relative.toLowerCase().split('/');
  const blockedDirs=new Set(['.git','.ssh','.aws','.azure','.config','secrets','node_modules','.next','.venv','venv','__pycache__']);
  if (parts.some(part=>blockedDirs.has(part))) return true;
  const name=parts.at(-1);
  if (name === '.env' || name.startsWith('.env.') || [
    '.npmrc','.netrc','.htpasswd','.ds_store','id_rsa','id_ed25519','authorized_keys',
    'credentials.json','secrets.json'
  ].includes(name)) return true;
  return /\.(pem|key|p12|pfx|sqlite3?|db|bak|log|dump|sql)$/i.test(name);
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
  '.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.pdf':'application/pdf','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.eot':'application/vnd.ms-fontobject','.mp4':'video/mp4','.webm':'video/webm','.webmanifest':'application/manifest+json','.wasm':'application/wasm'
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
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, {ok:true, service:'IZAKHONO HOST Runtime', version:'0.4.0'});
  if (req.method === 'GET' && url.pathname === '/api/tls/ask') {
    const domain = String(url.searchParams.get('domain') || '').trim().toLowerCase();
    const platformHosts = new Set(
      String(process.env.PLATFORM_TLS_HOSTS || '')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean)
    );
    if (platformHosts.has(domain)) return json(res, 200, {ok:true,domain,platform:true});
    const site = await findSite(domain);
    return site ? json(res, 200, {ok:true,domain:site.domain}) : json(res, 403, {ok:false,error:'Domain is not provisioned'});
  }
  if (!url.pathname.startsWith('/api/')) return serveSite(req, res);
  if (!authorized(req)) return json(res, 401, {ok:false,error:'Unauthorized'});

  if (req.method === 'GET' && url.pathname === '/api/control-centre') {
    const state=await loadState();
    const sites=[...state.sites].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const deployments=[...state.deployments].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,100);
    return json(res,200,{
      ok:true,
      generated_at:new Date().toISOString(),
      summary:{
        total_sites:sites.length,
        live_sites:sites.filter(site=>site.public_live===true).length,
        pending_acceptance:sites.filter(site=>site.public_live!==true).length,
        deployments:state.deployments.length
      },
      sites,
      deployments
    });
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
      state.deployments.push({id:id('dep'),site_id:site.id,action:'provision',status:'provisioned',created_at:new Date().toISOString()});
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
      const seenPaths=new Set();
      let total=0;
      for (const item of files) {
        const relative=safeRelative(item?.path);
        if (!relative) return json(res,400,{ok:false,error:'Invalid file path'});
        if (sensitiveDeploymentPath(relative)) return json(res,400,{ok:false,error:`Sensitive deployment path is blocked: ${relative}`});
        if (seenPaths.has(relative)) return json(res,400,{ok:false,error:`Duplicate deployment path: ${relative}`});
        seenPaths.add(relative);
        let data;
        if (typeof item?.content_base64 === 'string') {
          const encoded=item.content_base64;
          if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
            return json(res,400,{ok:false,error:`Invalid base64 content: ${relative}`});
          }
          data=Buffer.from(encoded,'base64');
          if (data.toString('base64') !== encoded) return json(res,400,{ok:false,error:`Non-canonical base64 content: ${relative}`});
        } else {
          data=Buffer.from(String(item?.content ?? ''),'utf8');
        }
        if (data.length > MAX_FILE_BYTES) return json(res,413,{ok:false,error:`File exceeds ${MAX_FILE_BYTES} bytes: ${relative}`});
        total += data.length;
        if (total > MAX_TOTAL_BYTES) return json(res,413,{ok:false,error:`Deployment exceeds ${MAX_TOTAL_BYTES} bytes`});
        normalized.push({path:relative,data});
      }
      if (!normalized.some(item=>item.path==='index.html')) return json(res,400,{ok:false,error:'Deployment must include index.html'});
      const base=path.resolve(siteDir(site.domain));
      const siteRoot=path.dirname(base);
      const stage=path.join(siteRoot,`.deploy-${crypto.randomUUID()}`);
      const previous=path.join(siteRoot,`.previous-${crypto.randomUUID()}`);
      await fs.mkdir(stage,{recursive:true});
      for (const item of normalized) {
        const target=path.resolve(stage,item.path);
        if (!target.startsWith(stage + path.sep)) return json(res,400,{ok:false,error:'Invalid deployment target'});
        await fs.mkdir(path.dirname(target),{recursive:true});
        await fs.writeFile(target,item.data);
      }
      let movedPrevious=false;
      try {
        try { await fs.rename(base,previous); movedPrevious=true; }
        catch (error) { if (error?.code !== 'ENOENT') throw error; }
        await fs.rename(stage,base);
        if (movedPrevious) await fs.rm(previous,{recursive:true,force:true}).catch(()=>{});
      } catch (error) {
        if (movedPrevious) await fs.rename(previous,base).catch(()=>{});
        await fs.rm(stage,{recursive:true,force:true}).catch(()=>{});
        throw error;
      }
      site.status='content_ready';
      site.public_live=false;
      site.acceptance={https:false,dns:false,content:true};
      site.accepted_at=null;
      const deployment={id:id('dep'),site_id:site.id,action:'content',status:'deployed',file_count:normalized.length,total_bytes:total,created_at:new Date().toISOString()};
      state.deployments.push(deployment);
      await saveState(state);
      return json(res,200,{ok:true,site,deployment});
    } catch (e) { return json(res,400,{ok:false,error:e?.message || 'Invalid deployment'}); }
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/sites\/[^/]+\/accept$/)) {
    const siteId=url.pathname.split('/')[3];
    const state=await loadState();
    const site=state.sites.find(s=>s.id===siteId);
    if(!site) return json(res,404,{ok:false,error:'Site not found'});
    const expectedIp=String(process.env.HOST_PUBLIC_IP||'').trim();
    let resolvedARecords=[];
    try { resolvedARecords=await dns.resolve4(site.domain); } catch {}
    const dnsOk=Boolean(expectedIp && resolvedARecords.includes(expectedIp));
    let httpsStatus=0;
    let contentOk=false;
    try {
      const response=await fetch(`https://${site.domain}/`,{redirect:'follow',signal:AbortSignal.timeout(10000)});
      httpsStatus=response.status;
      const html=await response.text();
      contentOk=response.ok && html.trim().length>0 && !html.includes('Site not provisioned on IZAKHONO HOST');
    } catch {}
    site.acceptance={dns:dnsOk,https:httpsStatus===200,content:contentOk};
    site.public_live=site.acceptance.dns && site.acceptance.https && site.acceptance.content;
    site.status=site.public_live?'live':'provisioned';
    site.accepted_at=new Date().toISOString();
    const deployment={id:id('dep'),site_id:site.id,action:'acceptance-check',status:site.public_live?'passed':'pending',created_at:new Date().toISOString(),evidence:{expected_ip:expectedIp||null,resolved_a_records:resolvedARecords,https_status:httpsStatus,content_ok:contentOk}};
    state.deployments.push(deployment);
    await saveState(state);
    return json(res,200,{ok:true,live:site.public_live,site,evidence:deployment.evidence});
  }

  return json(res,404,{ok:false,error:'Not found'});
});

server.listen(PORT, '0.0.0.0', () => console.log(`IZAKHONO HOST Runtime listening on ${PORT}`));
