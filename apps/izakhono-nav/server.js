const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleDriverCompanionChat } = require('./driver-companion-ai-route');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.svg':'image/svg+xml', '.css':'text/css; charset=utf-8', '.png':'image/png', '.ico':'image/x-icon' };
const PWA_HEAD = '<link rel="manifest" href="./manifest.webmanifest"><meta name="theme-color" content="#138b80">';
const PWA_BODY = '<script>(function(){if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(function(){})})}})();</script>';

function send(res, status, body, type='text/plain; charset=utf-8') { res.statusCode=status; res.setHeader('Content-Type',type); res.setHeader('Cache-Control','no-store'); res.end(body); }
function readBody(req){ return new Promise((resolve,reject)=>{ let data=''; req.on('data',chunk=>{data+=chunk;if(data.length>1024*1024){reject(new Error('body too large'));req.destroy();}}); req.on('end',()=>{try{resolve(data?JSON.parse(data):{});}catch(e){reject(e);}}); req.on('error',reject); }); }
function runtimeStatus(){
  const aiConfigured=Boolean(process.env.IZAKHONO_AI_CHAT_ENDPOINT && process.env.IZAKHONO_AI_API_KEY);
  return { ok:true, product:'IZAKHONO NAV', runtime:'owned', release:process.env.IZAKHONO_RELEASE || 'local', ai_provider:aiConfigured?'configured':'unavailable', pwa:true, voice_api:true };
}
function serveHtml(res, file, headOnly=false){
  fs.readFile(file,'utf8',(err,html)=>{
    if(err) return send(res,404,'Not Found');
    const body = html.replace('</head>',`${PWA_HEAD}</head>`).replace('</body>',`${PWA_BODY}</body>`);
    res.statusCode=200; res.setHeader('Content-Type',MIME['.html']); res.setHeader('X-Content-Type-Options','nosniff');
    if(headOnly) return res.end();
    res.end(body);
  });
}

const server = http.createServer(async (req,res)=>{
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/health') return send(res,200,JSON.stringify(runtimeStatus()),'application/json; charset=utf-8');
    if (url.pathname === '/ready') return send(res,200,JSON.stringify({ ...runtimeStatus(), ready:true }),'application/json; charset=utf-8');
    if (url.pathname === '/api/nav/driver-companion') {
      if (req.method !== 'POST') return send(res,405,JSON.stringify({ok:false,error:'method_not_allowed'}),'application/json; charset=utf-8');
      const body = await readBody(req);
      const result = await handleDriverCompanionChat({ method:req.method, body });
      return send(res,result.status,JSON.stringify(result.body),'application/json; charset=utf-8');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res,405,'Method Not Allowed');
    let relative = decodeURIComponent(url.pathname);
    if (relative === '/') relative = '/index.html';
    const file = path.resolve(ROOT, '.' + relative);
    if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT,'index.html')) return send(res,403,'Forbidden');
    fs.stat(file,(err,stat)=>{
      if (!err && stat.isFile()) {
        if (path.extname(file) === '.html') return serveHtml(res,file,req.method==='HEAD');
        res.statusCode=200; res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream'); res.setHeader('X-Content-Type-Options','nosniff'); if(req.method==='HEAD')return res.end(); return fs.createReadStream(file).pipe(res);
      }
      return serveHtml(res,path.join(ROOT,'index.html'),req.method==='HEAD');
    });
  } catch (err) { send(res,500,JSON.stringify({ok:false,error:'internal_error',message:err.message}),'application/json; charset=utf-8'); }
});

server.listen(PORT,'0.0.0.0',()=>console.log(`IZAKHONO NAV owned runtime listening on ${PORT}`));
