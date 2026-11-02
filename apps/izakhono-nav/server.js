const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handleDriverCompanionChat } = require('./driver-companion-ai-route');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.svg':'image/svg+xml', '.css':'text/css; charset=utf-8', '.png':'image/png', '.ico':'image/x-icon' };

function send(res, status, body, type='text/plain; charset=utf-8') { res.statusCode=status; res.setHeader('Content-Type',type); res.setHeader('Cache-Control','no-store'); res.end(body); }
function readBody(req){ return new Promise((resolve,reject)=>{ let data=''; req.on('data',chunk=>{data+=chunk;if(data.length>1024*1024){reject(new Error('body too large'));req.destroy();}}); req.on('end',()=>{try{resolve(data?JSON.parse(data):{});}catch(e){reject(e);}}); req.on('error',reject); }); }

const server = http.createServer(async (req,res)=>{
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/health') return send(res,200,JSON.stringify({ok:true,product:'IZAKHONO NAV',runtime:'owned',release:process.env.IZAKHONO_RELEASE || 'local'}),'application/json; charset=utf-8');
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
      if (!err && stat.isFile()) { res.statusCode=200; res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream'); res.setHeader('X-Content-Type-Options','nosniff'); if(req.method==='HEAD')return res.end(); return fs.createReadStream(file).pipe(res); }
      const fallback=path.join(ROOT,'index.html'); res.statusCode=200; res.setHeader('Content-Type',MIME['.html']); if(req.method==='HEAD')return res.end(); fs.createReadStream(fallback).pipe(res);
    });
  } catch (err) { send(res,500,JSON.stringify({ok:false,error:'internal_error',message:err.message}),'application/json; charset=utf-8'); }
});

server.listen(PORT,'0.0.0.0',()=>console.log(`IZAKHONO NAV owned runtime listening on ${PORT}`));
