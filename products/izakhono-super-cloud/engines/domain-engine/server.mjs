import http from 'node:http';
import crypto from 'node:crypto';
const PORT=Number(process.env.PORT||8194), ADMIN_TOKEN=process.env.SUPER_CLOUD_ADMIN_TOKEN||'';
const records=new Map();
function json(res,status,b){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(b));}
function auth(req){return !ADMIN_TOKEN||req.headers.authorization===`Bearer ${ADMIN_TOKEN}`;}
async function body(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{};}
function plan(x){
 if(!x.domain)return null;
 return {id:crypto.randomUUID(),domain:x.domain,projectId:x.projectId||null,desired:{dns:x.dns||[],tls:x.tls!==false,ingress:x.ingress||null},state:'planned',evidenceRequired:['dns-resolves','certificate-valid','https-health'],createdAt:new Date().toISOString()};
}
const server=http.createServer(async(req,res)=>{
 if(req.url==='/health'&&req.method==='GET')return json(res,200,{ok:true,engine:'domain-engine'});
 if(!auth(req))return json(res,401,{error:'unauthorized'});
 if(req.url==='/v1/status'&&req.method==='GET')return json(res,200,{engine:'domain-engine',domains:records.size});
 if(req.url==='/v1/domains'&&req.method==='POST'){const p=plan(await body(req));if(!p)return json(res,400,{error:'domain_required'});records.set(p.id,p);return json(res,202,p);}
 if(req.url==='/v1/domains'&&req.method==='GET')return json(res,200,{items:[...records.values()]});
 return json(res,404,{error:'not_found'});
});
server.listen(PORT,()=>console.log(`domain-engine listening on ${PORT}`));
