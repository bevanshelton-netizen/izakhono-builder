const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { handleDriverCompanionChat } = require('./driver-companion-ai-route');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const RELEASE = process.env.IZAKHONO_RELEASE || 'local';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.svg':'image/svg+xml', '.css':'text/css; charset=utf-8', '.png':'image/png', '.ico':'image/x-icon' };
const PWA_HEAD = '<link rel="manifest" href="./manifest.webmanifest"><meta name="theme-color" content="#138b80">';
const PWA_BODY = '<script>(function(){if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(function(){})})}})();</script>';
const AI_WINDOW_MS = 60 * 1000;
const AI_MAX_REQUESTS_PER_WINDOW = 30;
const MAX_BODY_BYTES = 1024 * 1024;
const aiRate = new Map();

function setHeaders(res, type, requestId) {
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(self), camera=()');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Request-Id', requestId);
}
function send(res, status, body, type='text/plain; charset=utf-8', requestId='unknown') {
  res.statusCode = status;
  setHeaders(res, type, requestId);
  res.end(body);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let data = '';
    let bytes = 0;
    let settled = false;
    const fail = (error) => { if (!settled) { settled = true; reject(error); } };
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        fail(Object.assign(new Error('body too large'), { code:'BODY_TOO_LARGE' }));
        req.resume();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (settled) return;
      try {
        const parsed = data ? JSON.parse(data) : {};
        settled = true;
        resolve(parsed);
      } catch (error) {
        if (!settled) {
          settled = true;
          error.code = 'INVALID_JSON';
          reject(error);
        }
      }
    });
    req.on('error', fail);
  });
}
function runtimeStatus(){
  const aiConfigured=Boolean(process.env.IZAKHONO_AI_CHAT_ENDPOINT && process.env.IZAKHONO_AI_API_KEY);
  return { ok:true, product:'IZAKHONO NAV', runtime:'owned', release:RELEASE, ai_provider:aiConfigured?'configured':'unavailable', pwa:true, voice_api:true };
}
// Caddy appends the actual peer address to X-Forwarded-For. Use the final
// hop, never the attacker-controlled first value. Direct requests fall back
// to the socket peer address.
function clientKey(req){
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length <= 1024) {
    const hops = forwarded.split(',');
    const last = hops[hops.length - 1].trim();
    if (last && /^[0-9a-fA-F:.]+$/.test(last)) return last;
  }
  return req.socket.remoteAddress || 'unknown';
}
function allowAiRequest(req){
  const key=clientKey(req), now=Date.now();
  const current=aiRate.get(key);
  if(!current || now-current.startedAt >= AI_WINDOW_MS){
    // Bound memory even if many distinct network peers arrive within one window.
    if (!current && aiRate.size >= 10000) {
      const oldestKey = aiRate.keys().next().value;
      if (oldestKey !== undefined) aiRate.delete(oldestKey);
    }
    aiRate.set(key,{startedAt:now,count:1});
    return true;
  }
  if(current.count >= AI_MAX_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}
setInterval(()=>{ const cutoff=Date.now()-AI_WINDOW_MS; for(const [key,value] of aiRate){ if(value.startedAt < cutoff) aiRate.delete(key); } }, AI_WINDOW_MS).unref();
function serveHtml(res, file, headOnly=false, requestId='unknown'){
  fs.readFile(file,'utf8',(err,html)=>{
    if(err) return send(res,404,'Not Found','text/plain; charset=utf-8',requestId);
    const body = html.replace('</head>',`${PWA_HEAD}</head>`).replace('</body>',`${PWA_BODY}</body>`);
    res.statusCode=200; setHeaders(res,MIME['.html'],requestId);
    if(headOnly) return res.end();
    res.end(body);
  });
}

const server = http.createServer(async (req,res)=>{
  const requestId = crypto.randomUUID();
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/health') return send(res,200,JSON.stringify(runtimeStatus()),'application/json; charset=utf-8',requestId);
    if (url.pathname === '/ready') return send(res,200,JSON.stringify({ ...runtimeStatus(), ready:true }),'application/json; charset=utf-8',requestId);
    if (url.pathname === '/version') return send(res,200,JSON.stringify({product:'IZAKHONO NAV',release:RELEASE,runtime:'owned'}),'application/json; charset=utf-8',requestId);
    if (url.pathname === '/api/nav/driver-companion') {
      if (req.method !== 'POST') return send(res,405,JSON.stringify({ok:false,error:'method_not_allowed'}),'application/json; charset=utf-8',requestId);
      if (!allowAiRequest(req)) { res.setHeader('Retry-After', '60'); return send(res,429,JSON.stringify({ok:false,error:'rate_limited',retry_after_seconds:60}),'application/json; charset=utf-8',requestId); }
      let body;
      try { body = await readBody(req); }
      catch (error) {
        if (error.code === 'BODY_TOO_LARGE') return send(res,413,JSON.stringify({ok:false,error:'payload_too_large'}),'application/json; charset=utf-8',requestId);
        if (error.code === 'INVALID_JSON') return send(res,400,JSON.stringify({ok:false,error:'invalid_json'}),'application/json; charset=utf-8',requestId);
        throw error;
      }
      const result = await handleDriverCompanionChat({ method:req.method, body });
      return send(res,result.status,JSON.stringify(result.body),'application/json; charset=utf-8',requestId);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res,405,'Method Not Allowed','text/plain; charset=utf-8',requestId);
    let relative = decodeURIComponent(url.pathname);
    if (relative === '/') relative = '/index.html';
    const file = path.resolve(ROOT, '.' + relative);
    if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT,'index.html')) return send(res,403,'Forbidden','text/plain; charset=utf-8',requestId);
    fs.stat(file,(err,stat)=>{
      if (!err && stat.isFile()) {
        if (path.extname(file) === '.html') return serveHtml(res,file,req.method==='HEAD',requestId);
        res.statusCode=200; setHeaders(res,MIME[path.extname(file)]||'application/octet-stream',requestId); if(req.method==='HEAD')return res.end(); return fs.createReadStream(file).pipe(res);
      }
      return serveHtml(res,path.join(ROOT,'index.html'),req.method==='HEAD',requestId);
    });
  } catch (err) { send(res,500,JSON.stringify({ok:false,error:'internal_error'}),'application/json; charset=utf-8',requestId); }
});

server.listen(PORT,'0.0.0.0',()=>console.log(`IZAKHONO NAV owned runtime listening on ${PORT}`));
function shutdown(signal){ console.log(`IZAKHONO NAV received ${signal}; shutting down`); server.close(()=>process.exit(0)); setTimeout(()=>process.exit(1),10000).unref(); }
process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
