import http from 'node:http';
const control=process.env.CONTROL_PLANE||'http://control-plane:8080';
let routes=[];
async function refresh(){try{const r=await fetch(`${control}/api/routes`);if(r.ok)routes=(await r.json()).routes||[];}catch{}}
setInterval(refresh,3000);refresh();
function pick(host){const h=String(host||'').split(':')[0].toLowerCase();return routes.find(r=>r.host&&r.host.toLowerCase()===h)||routes.find(r=>h.includes('allegro')&&r.app==='allegro-vibez')||routes[0];}
async function read(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks);}
const server=http.createServer(async(req,res)=>{
 if(req.url==='/healthz')return res.writeHead(200,{'content-type':'application/json'}),res.end(JSON.stringify({ok:true,service:'IZAKHONO EDGE',production_routes:routes.length}));
 const route=pick(req.headers.host);if(!route)return res.writeHead(503,{'content-type':'application/json'}),res.end(JSON.stringify({ok:false,error:'No production route'}));
 try{
   const target=new URL(req.url,route.endpoint);
   const headers=new Headers(req.headers);headers.delete('host');headers.set('x-izakhono-node','owned-runtime');headers.set('x-izakhono-deployment',route.deployment);
   const init={method:req.method,headers,redirect:'manual'};
   if(!['GET','HEAD'].includes(req.method))init.body=await read(req);
   const upstream=await fetch(target,{...init,duplex:'half'});
   const outHeaders={};for(const [k,v] of upstream.headers)if(k.toLowerCase()!=='transfer-encoding')outHeaders[k]=v;
   outHeaders['x-izakhono-deployment']=route.deployment;res.writeHead(upstream.status,outHeaders);return res.end(Buffer.from(await upstream.arrayBuffer()));
 }catch(e){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:'Upstream unavailable',detail:e.message}));}
});
server.listen(8080,'0.0.0.0',()=>console.log('IZAKHONO EDGE listening on 8080'));
