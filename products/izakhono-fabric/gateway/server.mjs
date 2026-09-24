import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const here=path.dirname(fileURLToPath(import.meta.url));
const registry=JSON.parse(await fs.readFile(path.join(here,"wave1-adapters.json"),"utf8"));
const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8090);
const CRM_URL=(process.env.IZAKHONO_CRM_URL||"http://127.0.0.1:8080").replace(/\/$/,"");
const CRM_TOKEN=process.env.IZAKHONO_CRM_INGEST_TOKEN||"";
const INTERNAL_TOKEN=process.env.IZAKHONO_FABRIC_INTERNAL_TOKEN||"";
const PUBLIC_ENABLED=/^(1|true|yes)$/i.test(process.env.IZAKHONO_FABRIC_PUBLIC_INTAKE||"false");
const ALLOW_ORIGINLESS=/^(1|true|yes)$/i.test(process.env.IZAKHONO_FABRIC_ALLOW_ORIGINLESS||"false");
const ALLOWED_ORIGINS=new Set((process.env.IZAKHONO_FABRIC_ALLOWED_ORIGINS||"").split(",").map(v=>v.trim()).filter(Boolean));
const OUTBOX_FILE=process.env.FABRIC_OUTBOX_FILE||path.join(here,"outbox.json");
let writeChain=Promise.resolve();

const clean=(v,max=500)=>String(v??"").trim().slice(0,max);
const now=()=>new Date().toISOString();
const eventId=()=>`fab_${crypto.randomUUID()}`;

function response(res,status,body,extra={}){
  const data=JSON.stringify(body);
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(data),"cache-control":"no-store",...extra});
  res.end(data);
}
function bearer(req){const v=req.headers.authorization||"";return v.startsWith("Bearer ")?v.slice(7):""}
function safeEqual(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
async function readBody(req,limit=128*1024){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error("body too large"),{status:413});chunks.push(chunk)}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString("utf8"))}catch{throw Object.assign(new Error("invalid json"),{status:400})}}
function platformConfig(id){return registry.platforms[clean(id,80)]||null}
function publicOriginAllowed(req){
  const origin=clean(req.headers.origin,400);
  if(!origin)return ALLOW_ORIGINLESS;
  return ALLOWED_ORIGINS.has(origin);
}
function normalizeEvent(body,platform){
  const type=clean(body.event_type,100);
  const stage=platform.stages[type];
  if(!stage)throw Object.assign(new Error("event type is not approved for this platform"),{status:400});
  const contact=body.contact&&typeof body.contact==="object"?body.contact:{};
  const opportunity=body.opportunity&&typeof body.opportunity==="object"?body.opportunity:{};
  const subjectRef=clean(body.subject_ref||body.external_ref||body.event_id,180)||eventId();
  const value=Number(opportunity.value||0);
  return {
    id:clean(body.event_id,180)||eventId(),
    event_type:type,
    subject_ref:subjectRef,
    contact:{
      name:clean(contact.name,200),
      email:clean(contact.email,320).toLowerCase(),
      phone:clean(contact.phone,80),
      company:clean(contact.company,200),
      role:clean(contact.role,120),
      source:clean(contact.source||body.source||"app-fabric",120)
    },
    deal:{
      title:clean(opportunity.title||platform.default_title,240),
      value:Number.isFinite(value)?value:0,
      currency:clean(opportunity.currency||"ZAR",8).toUpperCase(),
      stage,
      source:clean(opportunity.source||body.source||"app-fabric",120),
      external_ref:`${platform.platform_id}:${subjectRef}`,
      next_action:clean(opportunity.next_action,500),
      next_action_due:clean(opportunity.next_action_due,40)
    },
    note:clean(body.note||`${type} received through IZAKHONO APP FABRIC`,1000)
  };
}
async function readOutbox(){try{const v=JSON.parse(await fs.readFile(OUTBOX_FILE,"utf8"));return Array.isArray(v)?v:[]}catch(e){if(e.code==="ENOENT")return[];throw e}}
async function writeOutbox(items){writeChain=writeChain.then(async()=>{await fs.mkdir(path.dirname(OUTBOX_FILE),{recursive:true});const tmp=`${OUTBOX_FILE}.${process.pid}.tmp`;await fs.writeFile(tmp,JSON.stringify(items,null,2),{mode:0o600});await fs.rename(tmp,OUTBOX_FILE)});return writeChain}
async function queue(item,error){const items=await readOutbox();items.push({...item,queued_at:now(),last_error:clean(error?.message||error,500)});await writeOutbox(items.slice(-5000))}
async function sendToCrm(platform,event){
  const headers={"content-type":"application/json","x-entity-id":platform.entity_id,"x-platform-id":platform.platform_id};
  if(CRM_TOKEN)headers.authorization=`Bearer ${CRM_TOKEN}`;
  const r=await fetch(`${CRM_URL}/api/intake`,{method:"POST",headers,body:JSON.stringify({contact:event.contact,create_deal:true,deal:event.deal,note:event.note})});
  if(!r.ok)throw new Error(`CRM returned ${r.status}: ${(await r.text()).slice(0,200)}`);
  return r.json();
}
async function deliver(platformId,body){
  const platform=platformConfig(platformId);if(!platform)throw Object.assign(new Error("unknown platform"),{status:404});
  const event=normalizeEvent(body,platform);
  try{
    const crm=await sendToCrm(platform,event);
    return {status:201,body:{ok:true,delivery:"crm",event_id:event.id,crm}};
  }catch(error){
    await queue({platform_id:platformId,event},error);
    return {status:202,body:{ok:true,delivery:"queued",event_id:event.id}};
  }
}
async function replay(){
  const items=await readOutbox(),remaining=[];let delivered=0;
  for(const item of items){
    try{const platform=platformConfig(item.platform_id);if(!platform)throw new Error("unknown platform");await sendToCrm(platform,item.event);delivered++}
    catch(error){remaining.push({...item,last_error:clean(error?.message||error,500),last_attempt_at:now()})}
  }
  await writeOutbox(remaining);
  return {delivered,remaining:remaining.length};
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
    if(req.method==="GET"&&url.pathname==="/health")return response(res,200,{ok:true,service:"izakhono-app-fabric-gateway",version:"0.1.0",public_intake:PUBLIC_ENABLED});
    if(req.method==="POST"&&url.pathname==="/api/fabric/intake"){
      if(!PUBLIC_ENABLED)return response(res,503,{error:"public intake is not enabled"});
      if(!publicOriginAllowed(req))return response(res,403,{error:"origin not allowed"});
      const body=await readBody(req),platformId=clean(body.platform_id||req.headers["x-izakhono-platform"],80);
      const platform=platformConfig(platformId);if(!platform)return response(res,404,{error:"unknown platform"});
      if(!platform.public_events.includes(clean(body.event_type,100)))return response(res,403,{error:"event is not permitted on public intake"});
      const result=await deliver(platformId,body);return response(res,result.status,result.body);
    }
    if(req.method==="POST"&&url.pathname==="/api/fabric/event"){
      if(!INTERNAL_TOKEN||!safeEqual(bearer(req),INTERNAL_TOKEN))return response(res,401,{error:"unauthorized"});
      const body=await readBody(req),platformId=clean(body.platform_id||req.headers["x-izakhono-platform"],80);
      const result=await deliver(platformId,body);return response(res,result.status,result.body);
    }
    if(req.method==="POST"&&url.pathname==="/api/fabric/replay"){
      if(!INTERNAL_TOKEN||!safeEqual(bearer(req),INTERNAL_TOKEN))return response(res,401,{error:"unauthorized"});
      return response(res,200,{ok:true,...await replay()});
    }
    return response(res,404,{error:"not found"});
  }catch(error){console.error(error);return response(res,error.status||500,{error:error.status?error.message:"internal server error"})}
});
server.listen(PORT,HOST,()=>console.log(`IZAKHONO APP FABRIC Gateway listening on http://${HOST}:${PORT}`));
