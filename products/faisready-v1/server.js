const http = require("node:http");
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const CORE_ENDPOINT = String(process.env.FAISREADY_CORE_ENDPOINT || "http://izakhono-core:8787").replace(/\/$/,"");
const CORE_PROJECT = process.env.FAISREADY_CORE_PROJECT || "faisready";
const CORE_PROJECT_KEY = process.env.FAISREADY_CORE_PROJECT_KEY || "";
const CRM_ENDPOINT = String(process.env.FAISREADY_CRM_ENDPOINT || "http://izakhono-crm:8080").replace(/\/$/,"");
const CRM_ADMIN_TOKEN = process.env.FAISREADY_CRM_ADMIN_TOKEN || "";
const CRM_INGEST_TOKEN = process.env.FAISREADY_CRM_INGEST_TOKEN || "";
const ENTITY_ID = process.env.FAISREADY_ENTITY_ID || "izakhono-africa";
const PLATFORM_ID = "faisready";
const COMMERCIAL_READY = process.env.FAISREADY_COMMERCIAL_READY === "true";

function headers(type="application/json; charset=utf-8") {
  return {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self' https://pay.ikhokha.com; base-uri 'self'; frame-ancestors 'none'"
  };
}
function send(res,status,body,type){ const b=Buffer.isBuffer(body)?body:Buffer.from(String(body)); res.writeHead(status,{...headers(type),"content-length":b.length}); res.end(b); }
function json(res,status,obj){ send(res,status,JSON.stringify(obj),"application/json; charset=utf-8"); }
async function bodyJson(req,limit=256000){
  const chunks=[]; let total=0;
  for await (const chunk of req){ total+=chunk.length; if(total>limit) throw Object.assign(new Error("body too large"),{status:413}); chunks.push(chunk); }
  if(!chunks.length) return {};
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw Object.assign(new Error("invalid json"),{status:400});}
}
function bearer(req){ const m=String(req.headers.authorization||"").match(/^Bearer\s+(.+)$/i); return m?m[1]:""; }
async function fetchJson(url,options={}){
  const r=await fetch(url,options); const text=await r.text(); let data={}; try{data=text?JSON.parse(text):{};}catch{data={error:text||"invalid upstream response"};}
  return {ok:r.ok,status:r.status,data};
}
async function verifyOwner(req){
  if(!CORE_PROJECT_KEY) return {ok:false,status:503,error:"owner authentication is not provisioned"};
  const token=bearer(req); if(!token) return {ok:false,status:401,error:"sign in required"};
  const r=await fetchJson(`${CORE_ENDPOINT}/v1/auth/${CORE_PROJECT}/me`,{headers:{authorization:`Bearer ${token}`,"x-project-key":CORE_PROJECT_KEY}});
  return r.ok ? {ok:true,user:r.data} : {ok:false,status:r.status,error:r.data.error||"invalid session"};
}
function crmHeaders(admin=true){
  const token=admin?CRM_ADMIN_TOKEN:CRM_INGEST_TOKEN;
  return {"content-type":"application/json","x-entity-id":ENTITY_ID,"x-platform-id":PLATFORM_ID,...(token?{authorization:`Bearer ${token}`}:{})};
}
async function catalog(){
  const raw=await fsp.readFile(path.join(ROOT,"merch.json"),"utf8");
  return JSON.parse(raw);
}
function safe(value,max=200){ return String(value??"").trim().slice(0,max); }
function id(prefix){ return `${prefix}_${crypto.randomUUID()}`; }

async function ownerApi(req,res,url){
  if(req.method==="POST" && url.pathname==="/api/owner/signin"){
    if(!CORE_PROJECT_KEY) return json(res,503,{error:"Owner account provisioning has not been completed on NODE01."});
    const payload=await bodyJson(req);
    const upstream=await fetchJson(`${CORE_ENDPOINT}/v1/auth/${CORE_PROJECT}/signin`,{
      method:"POST",headers:{"content-type":"application/json","x-project-key":CORE_PROJECT_KEY},
      body:JSON.stringify({email:safe(payload.email,254),password:String(payload.password||"")})
    });
    return json(res,upstream.status,upstream.data);
  }
  const auth=await verifyOwner(req);
  if(!auth.ok) return json(res,auth.status,{error:auth.error});
  if(req.method==="GET" && url.pathname==="/api/owner/me") return json(res,200,auth.user);
  if(req.method==="GET" && url.pathname==="/api/owner/summary"){
    if(!CRM_ADMIN_TOKEN) return json(res,503,{error:"CRM owner bridge is not provisioned."});
    const [summary,insights,deals,contacts]=await Promise.all([
      fetchJson(`${CRM_ENDPOINT}/api/summary`,{headers:crmHeaders(true)}),
      fetchJson(`${CRM_ENDPOINT}/api/insights`,{headers:crmHeaders(true)}),
      fetchJson(`${CRM_ENDPOINT}/api/deals`,{headers:crmHeaders(true)}),
      fetchJson(`${CRM_ENDPOINT}/api/contacts`,{headers:crmHeaders(true)})
    ]);
    if(!summary.ok) return json(res,summary.status,{error:summary.data.error||"CRM summary unavailable"});
    const merch=(deals.data.items||[]).filter(d=>String(d.source||"").includes("faisready-merch")||String(d.title||"").startsWith("FAISReady Merch"));
    return json(res,200,{user:auth.user,summary:summary.data,insights:insights.data,deals:(deals.data.items||[]).slice(0,50),contacts:(contacts.data.items||[]).slice(0,50),merch_orders:merch.slice(0,50)});
  }
  if(req.method==="PATCH" && url.pathname.startsWith("/api/owner/deals/")){
    if(!CRM_ADMIN_TOKEN) return json(res,503,{error:"CRM owner bridge is not provisioned."});
    const dealId=decodeURIComponent(url.pathname.slice("/api/owner/deals/".length));
    const payload=await bodyJson(req);
    const allowed={};
    for(const k of ["stage","next_action","next_action_due","owner"]) if(k in payload) allowed[k]=payload[k];
    const upstream=await fetchJson(`${CRM_ENDPOINT}/api/deals/${encodeURIComponent(dealId)}`,{method:"PATCH",headers:crmHeaders(true),body:JSON.stringify(allowed)});
    return json(res,upstream.status,upstream.data);
  }
  return json(res,404,{error:"not found"});
}

async function merchOrder(req,res){
  if(req.method!=="POST") return json(res,405,{error:"method not allowed"});
  if(!CRM_INGEST_TOKEN && !CRM_ADMIN_TOKEN) return json(res,503,{error:"Order intake is not provisioned."});
  const payload=await bodyJson(req);
  const cat=await catalog();
  const byId=new Map(cat.items.filter(x=>x.active).map(x=>[x.id,x]));
  const lines=Array.isArray(payload.items)?payload.items:[];
  if(!lines.length) return json(res,400,{error:"cart is empty"});
  let total=0; const cleanLines=[];
  for(const line of lines.slice(0,20)){
    const item=byId.get(safe(line.id,80)); if(!item) return json(res,400,{error:"invalid merchandise item"});
    const qty=Math.max(1,Math.min(50,Number.parseInt(line.qty||1,10)||1));
    const size=safe(line.size,20);
    if(item.sizes?.length && !item.sizes.includes(size)) return json(res,400,{error:`invalid size for ${item.name}`});
    const lineTotal=Number.isFinite(item.price)?item.price*qty:0;
    total+=lineTotal;
    cleanLines.push({id:item.id,name:item.name,price:item.price,qty,size,line_total:lineTotal,quote_only:Boolean(item.quote_only)});
  }
  const name=safe(payload.name,200), mobile=safe(payload.mobile,80), email=safe(payload.email,254).toLowerCase();
  if(!name || !mobile) return json(res,400,{error:"name and mobile number are required"});
  const orderRef=id("merch");
  const summary=cleanLines.map(x=>`${x.qty}x ${x.name}${x.size?` (${x.size})`:""}`).join("; ");
  const intake={
    contact:{name,email,phone:mobile,source:"faisready-merch",status:"order-request",tags:["merch","faisready"]},
    deal:{title:`FAISReady Merch — ${name}`,value:total,currency:"ZAR",stage:"Merch order requested",source:"faisready-merch",external_ref:orderRef,next_action:"Confirm stock, delivery and send verified iKhokha payment route"},
    note:`Merch order ${orderRef}. Items: ${summary}. Delivery: ${safe(payload.delivery,300)}. No payment confirmation claimed.`
  };
  const upstream=await fetchJson(`${CRM_ENDPOINT}/api/intake`,{method:"POST",headers:crmHeaders(false),body:JSON.stringify(intake)});
  if(!upstream.ok) return json(res,upstream.status,{error:upstream.data.error||"order intake unavailable"});
  return json(res,201,{ok:true,order_ref:orderRef,total,currency:"ZAR",payment_status:"NOT_PAID",next_step:"Stock and delivery confirmation followed by a verified iKhokha payment route."});
}

const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".jpg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml",".b64":"text/plain; charset=utf-8"};
async function staticFile(req,res,url){
  let rel=url.pathname==="/"?"index.html":decodeURIComponent(url.pathname.replace(/^\//,""));
  if(rel==="owner") rel="owner/index.html";
  if(rel.endsWith("/")) rel+="index.html";
  const full=path.resolve(ROOT,rel);
  if(full!==ROOT && !full.startsWith(ROOT+path.sep)) return json(res,403,{error:"forbidden"});
  try{ const data=await fsp.readFile(full); return send(res,200,data,mime[path.extname(full).toLowerCase()]||"application/octet-stream"); }
  catch(e){ if(e.code==="ENOENT") return json(res,404,{error:"not found"}); throw e; }
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
    if(req.method==="GET" && url.pathname==="/healthz") return json(res,200,{ok:true,service:"faisready",owner_auth:Boolean(CORE_PROJECT_KEY),crm:Boolean(CRM_ADMIN_TOKEN||CRM_INGEST_TOKEN)});
    if(req.method==="GET" && url.pathname==="/readiness") return json(res,200,{commercial_ready:Boolean(COMMERCIAL_READY&&CORE_PROJECT_KEY&&(CRM_INGEST_TOKEN||CRM_ADMIN_TOKEN)),owned_first:true,payment_boundary:"verified-links-only"});
    if(url.pathname.startsWith("/api/owner/")) return ownerApi(req,res,url);
    if(url.pathname==="/api/merch/order") return merchOrder(req,res);
    return staticFile(req,res,url);
  }catch(error){ console.error(error); return json(res,error.status||500,{error:error.status?error.message:"internal server error"}); }
});
server.listen(PORT,HOST,()=>console.log(`FAISReady listening on http://${HOST}:${PORT}`));
