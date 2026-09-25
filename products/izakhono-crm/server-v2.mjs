import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8080);
const DATA_FILE = process.env.CRM_DATA_FILE || path.join(__dirname, "crm-data.json");
const STAFF_FILE = process.env.CRM_STAFF_FILE || "";
const ADMIN_TOKEN = process.env.CRM_ADMIN_TOKEN || "";
const INGEST_TOKEN = process.env.CRM_INGEST_TOKEN || "";
const ALLOW_INSECURE_LOCAL = process.env.CRM_ALLOW_INSECURE_LOCAL !== "false";
const EMPTY = { contacts: [], deals: [], activities: [], pipelines: [], automation_rules: [], integration_outbox: [], audit: [] };
const ROLE_PERMISSIONS = {
  owner: ["*"],
  admin: ["crm.read","contacts.write","deals.write","activities.write","pipeline.manage","automation.manage","integrations.manage","audit.read","export.read"],
  manager: ["crm.read","contacts.write","deals.write","activities.write","pipeline.manage","automation.manage","integrations.manage"],
  agent: ["crm.read","contacts.write","deals.write","activities.write"],
  viewer: ["crm.read"],
  integration: ["integration.ingest"]
};
let writeChain = Promise.resolve();
let staffCache = { mtime: 0, rows: [] };
let registryCache = null;

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function cleanString(value, max = 500) { return String(value ?? "").trim().slice(0, max); }
function cleanTags(value) { return Array.isArray(value) ? value.map(v => cleanString(v, 64)).filter(Boolean).slice(0, 20) : []; }
function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type":"application/json; charset=utf-8", "content-length":Buffer.byteLength(data), "cache-control":"no-store" });
  res.end(data);
}
function text(res, status, body, contentType="text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type":contentType, "content-length":Buffer.byteLength(body), "cache-control":"no-store" });
  res.end(body);
}
function bearer(req) { const raw=req.headers.authorization||""; return raw.startsWith("Bearer ") ? raw.slice(7) : ""; }
function hashToken(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function safeEqual(a,b) { if(!a||!b) return false; const aa=Buffer.from(a); const bb=Buffer.from(b); return aa.length===bb.length && crypto.timingSafeEqual(aa,bb); }
function scopeFrom(req,url) {
  const entity=cleanString(req.headers["x-entity-id"]||url.searchParams.get("entity"),120);
  const platform=cleanString(req.headers["x-platform-id"]||url.searchParams.get("platform"),120);
  return entity&&platform ? {entity_id:entity,platform_id:platform} : null;
}
function scoped(rows,scope){ return rows.filter(r=>r.entity_id===scope.entity_id && r.platform_id===scope.platform_id); }

async function readStore(){
  try {
    const parsed=JSON.parse(await fs.readFile(DATA_FILE,"utf8"));
    return Object.fromEntries(Object.keys(EMPTY).map(k=>[k,Array.isArray(parsed[k])?parsed[k]:[]]));
  } catch(error){ if(error.code==="ENOENT") return structuredClone(EMPTY); throw error; }
}
async function writeStore(store){
  writeChain=writeChain.then(async()=>{
    await fs.mkdir(path.dirname(DATA_FILE),{recursive:true});
    const temp=`${DATA_FILE}.${process.pid}.tmp`;
    await fs.writeFile(temp,JSON.stringify(store,null,2),{mode:0o600});
    await fs.rename(temp,DATA_FILE);
  });
  return writeChain;
}
async function readBody(req,limit=1024*1024){
  let size=0; const chunks=[];
  for await(const chunk of req){ size+=chunk.length; if(size>limit) throw Object.assign(new Error("body too large"),{status:413}); chunks.push(chunk); }
  if(!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("invalid json"),{status:400}); }
}

async function loadStaff(){
  if(!STAFF_FILE) return [];
  try {
    const st=await fs.stat(STAFF_FILE);
    if(staffCache.mtime===st.mtimeMs) return staffCache.rows;
    const parsed=JSON.parse(await fs.readFile(STAFF_FILE,"utf8"));
    staffCache={mtime:st.mtimeMs,rows:Array.isArray(parsed)?parsed:(parsed.staff||[])};
    return staffCache.rows;
  } catch(error){ if(error.code==="ENOENT") return []; throw error; }
}
function scopeAllowed(actor,scope){
  if(actor.role==="owner") return true;
  const scopes=Array.isArray(actor.scopes)?actor.scopes:[];
  return scopes.some(s=>(s.entity_id==="*"||s.entity_id===scope.entity_id)&&(s.platform_id==="*"||s.platform_id===scope.platform_id));
}
function permissionAllowed(actor,permission){ const perms=ROLE_PERMISSIONS[actor.role]||[]; return perms.includes("*")||perms.includes(permission); }
async function authenticate(req,scope,{ingest=false}={}){
  const token=bearer(req);
  if(ADMIN_TOKEN && safeEqual(token,ADMIN_TOKEN)) return {id:"owner-token",name:"Owner",role:"owner",scopes:[{entity_id:"*",platform_id:"*"}]};
  if(ingest && INGEST_TOKEN && safeEqual(token,INGEST_TOKEN)) return {id:"ingest-token",name:"Platform adapter",role:"integration",scopes:[scope||{entity_id:"*",platform_id:"*"}]};
  for(const row of await loadStaff()){
    const ok=row.token_sha256 ? safeEqual(hashToken(token),row.token_sha256) : (row.token && safeEqual(token,row.token));
    if(ok) return {id:cleanString(row.id||row.name,120),name:cleanString(row.name||row.id,160),role:cleanString(row.role||"viewer",40).toLowerCase(),scopes:Array.isArray(row.scopes)?row.scopes:[]};
  }
  if(!ADMIN_TOKEN && !INGEST_TOKEN && !(await loadStaff()).length && ALLOW_INSECURE_LOCAL) return {id:"local-dev",name:"Local development",role:"owner",scopes:[{entity_id:"*",platform_id:"*"}]};
  return null;
}
async function requireAccess(req,res,scope,permission,{ingest=false}={}){
  const actor=await authenticate(req,scope,{ingest});
  if(!actor) { json(res,401,{error:"unauthorized"}); return null; }
  if(scope && !scopeAllowed(actor,scope)) { json(res,403,{error:"scope denied"}); return null; }
  if(!permissionAllowed(actor,permission)) { json(res,403,{error:"permission denied",required:permission}); return null; }
  return actor;
}

async function loadRegistry(){
  if(registryCache) return registryCache;
  try { registryCache=JSON.parse(await fs.readFile(path.join(__dirname,"portfolio-crm-registry.json"),"utf8")); }
  catch { registryCache={platforms:[]}; }
  return registryCache;
}
function defaultStages(platform){
  const src=Array.isArray(platform?.stages)&&platform.stages.length ? platform.stages : ["New","Qualified","Proposal","Negotiation","Won","Lost"];
  return src.map((label,index)=>({id:`stage_${index+1}`,label,probability:/won/i.test(label)?100:/lost/i.test(label)?0:Math.min(90,index*20),terminal:/(won|lost|closed|complete)/i.test(label)}));
}
async function getPipeline(store,scope){
  let row=scoped(store.pipelines,scope)[0];
  if(row) return row;
  const registry=await loadRegistry();
  const platform=(registry.platforms||[]).find(p=>p.platform_id===scope.platform_id&&(!p.entity_id||p.entity_id===scope.entity_id));
  return {id:"default",...scope,name:platform?.name?`${platform.name} Pipeline`:"Default Pipeline",stages:defaultStages(platform),is_default:true,created_at:null,updated_at:null};
}
function pipelineStage(pipeline,label){ return (pipeline.stages||[]).find(s=>String(s.label).toLowerCase()===String(label).toLowerCase()); }
function validatePipelineInput(body){
  const name=cleanString(body.name||"Sales Pipeline",160);
  const stages=(Array.isArray(body.stages)?body.stages:[]).slice(0,30).map((s,i)=>({
    id:cleanString(s.id||`stage_${i+1}`,80), label:cleanString(s.label,120),
    probability:Math.max(0,Math.min(100,Number(s.probability||0))), terminal:Boolean(s.terminal)
  })).filter(s=>s.label);
  if(stages.length<2) throw Object.assign(new Error("pipeline requires at least two stages"),{status:400});
  if(new Set(stages.map(s=>s.label.toLowerCase())).size!==stages.length) throw Object.assign(new Error("pipeline stage labels must be unique"),{status:400});
  return {name,stages};
}
function contactPayload(body,scope){ return {...scope,name:cleanString(body.name,200),email:cleanString(body.email,320).toLowerCase(),phone:cleanString(body.phone,80),company:cleanString(body.company,200),role:cleanString(body.role,120),source:cleanString(body.source,120),status:cleanString(body.status||"lead",80),tags:cleanTags(body.tags)}; }
function dealPayload(body,scope){ const value=Number(body.value||0); return {...scope,contact_id:cleanString(body.contact_id,120),title:cleanString(body.title||"New opportunity",240),value:Number.isFinite(value)?value:0,currency:cleanString(body.currency||"ZAR",8).toUpperCase(),stage:cleanString(body.stage||"",120),owner:cleanString(body.owner,160),source:cleanString(body.source,120),external_ref:cleanString(body.external_ref,200),next_action:cleanString(body.next_action,500),next_action_due:cleanString(body.next_action_due,40)}; }
function addAudit(store,scope,actor,action,target_type,target_id,detail={}){
  store.audit.push({id:id("audit"),...scope,actor_id:actor?.id||"system",actor_name:actor?.name||"System",actor_role:actor?.role||"system",action,target_type,target_id,detail,created_at:now()});
  if(store.audit.length>10000) store.audit.splice(0,store.audit.length-10000);
}
function emitOutbox(store,scope,event_type,payload){
  const row={id:id("evt"),...scope,event_type,payload,status:"pending",attempts:0,created_at:now(),updated_at:now()};
  store.integration_outbox.push(row); return row;
}
function conditionMatches(rule,event){
  const c=rule.conditions||{};
  for(const [key,value] of Object.entries(c)){
    const actual=event[key];
    if(Array.isArray(value)){ if(!value.map(String).includes(String(actual))) return false; }
    else if(String(actual??"")!==String(value??"")) return false;
  }
  return true;
}
function applyAutomationActions(store,scope,rule,event,actor){
  const outputs=[];
  for(const action of Array.isArray(rule.actions)?rule.actions:[]){
    const deal=event.deal_id ? store.deals.find(d=>d.id===event.deal_id&&d.entity_id===scope.entity_id&&d.platform_id===scope.platform_id) : null;
    if(action.type==="create_activity"){
      const row={id:id("activity"),...scope,contact_id:event.contact_id||deal?.contact_id||"",deal_id:event.deal_id||"",type:cleanString(action.activity_type||"follow_up",80),note:cleanString(action.note||rule.name,2000),due_at:cleanString(action.due_at||"",40),completed:false,created_at:now(),updated_at:now()};
      store.activities.push(row); outputs.push({type:action.type,id:row.id});
    } else if(action.type==="set_next_action" && deal){
      deal.next_action=cleanString(action.value||action.note,500); deal.updated_at=now(); outputs.push({type:action.type,deal_id:deal.id});
    } else if(action.type==="set_owner" && deal){
      deal.owner=cleanString(action.value,160); deal.updated_at=now(); outputs.push({type:action.type,deal_id:deal.id});
    } else if(action.type==="add_contact_tag"){
      const contactId=event.contact_id||deal?.contact_id; const contact=store.contacts.find(c=>c.id===contactId&&c.entity_id===scope.entity_id&&c.platform_id===scope.platform_id);
      if(contact){ contact.tags=[...new Set([...(contact.tags||[]),cleanString(action.value,64)].filter(Boolean))].slice(0,20); contact.updated_at=now(); outputs.push({type:action.type,contact_id:contact.id}); }
    }
  }
  if(outputs.length) addAudit(store,scope,actor||{id:"automation",name:"Automation",role:"system"},"automation.executed","automation_rule",rule.id,{event:event.type,outputs});
  return outputs;
}
function runAutomations(store,scope,event){
  const rules=scoped(store.automation_rules,scope).filter(r=>r.enabled&&r.event===event.type&&conditionMatches(r,event));
  const fired=[]; for(const rule of rules) fired.push({rule_id:rule.id,outputs:applyAutomationActions(store,scope,rule,event,{id:"automation",name:"Automation",role:"system"})});
  return fired;
}
function summary(store,scope){
  const contacts=scoped(store.contacts,scope),deals=scoped(store.deals,scope),activities=scoped(store.activities,scope);
  const won=deals.filter(d=>/(^|\b)won(\b|$)/i.test(d.stage)); const open=deals.filter(d=>!/(^|\b)(won|lost)(\b|$)/i.test(d.stage));
  const byStage={}; for(const d of deals) byStage[d.stage]=(byStage[d.stage]||0)+1;
  return {scope,contacts:contacts.length,open_deals:open.length,pipeline_value:open.reduce((s,d)=>s+Number(d.value||0),0),won_value:won.reduce((s,d)=>s+Number(d.value||0),0),activities:activities.length,by_stage:byStage,pending_integration_events:scoped(store.integration_outbox,scope).filter(e=>e.status==="pending").length};
}
function insights(store,scope){
  const deals=scoped(store.deals,scope),today=Date.now(),open=deals.filter(d=>!/(^|\b)(won|lost)(\b|$)/i.test(d.stage));
  const overdue=open.filter(d=>d.next_action_due&&Date.parse(d.next_action_due)<today),stale=open.filter(d=>today-Date.parse(d.updated_at||d.created_at)>7*86400000),highValue=[...open].sort((a,b)=>Number(b.value||0)-Number(a.value||0)).slice(0,5),recommendations=[];
  if(overdue.length) recommendations.push(`${overdue.length} open deal(s) have an overdue next action.`);
  if(stale.length) recommendations.push(`${stale.length} open deal(s) have had no update for more than 7 days.`);
  if(highValue[0]?.value>0) recommendations.push(`Highest-value open opportunity: ${highValue[0].title} (${highValue[0].currency} ${Number(highValue[0].value).toLocaleString("en-ZA")}).`);
  if(!recommendations.length) recommendations.push("No urgent deterministic follow-up flags are currently detected.");
  return {overdue,stale,high_value:highValue,recommendations,mode:"deterministic-v2"};
}
async function serveStatic(url,res){
  if(url.pathname==="/"||url.pathname==="/index.html") return text(res,200,await fs.readFile(path.join(__dirname,"public","index.html"),"utf8"),"text/html; charset=utf-8");
  if(url.pathname==="/app.js") return text(res,200,await fs.readFile(path.join(__dirname,"public","app.js"),"utf8"),"text/javascript; charset=utf-8");
  if(url.pathname==="/registry.json") return text(res,200,await fs.readFile(path.join(__dirname,"portfolio-crm-registry.json"),"utf8"),"application/json; charset=utf-8");
  return false;
}

async function handler(req,res){
  try {
    const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
    if(req.method==="GET"&&url.pathname==="/health") return json(res,200,{ok:true,service:"izakhono-crm",version:"0.2.0",auth:STAFF_FILE?"staff-file":ADMIN_TOKEN?"admin-token":ALLOW_INSECURE_LOCAL?"local-dev":"locked"});
    if(!url.pathname.startsWith("/api/")){ const served=await serveStatic(url,res); if(served!==false) return served; return json(res,404,{error:"not found"}); }
    const scope=scopeFrom(req,url); if(!scope) return json(res,400,{error:"X-Entity-ID and X-Platform-ID are required"});

    if(req.method==="POST"&&url.pathname==="/api/intake"){
      const actor=await requireAccess(req,res,scope,"integration.ingest",{ingest:true}); if(!actor) return;
      const body=await readBody(req),store=await readStore(),payload=contactPayload(body.contact||body,scope),dp=(body.deal||body.create_deal)?dealPayload(body.deal||body,scope):null;
      let deal=dp?.external_ref?scoped(store.deals,scope).find(r=>r.external_ref===dp.external_ref)||null:null;
      const hasContactInput=Boolean(payload.name||payload.email||payload.phone||payload.company);
      let contact=hasContactInput?scoped(store.contacts,scope).find(r=>(payload.email&&r.email===payload.email)||(payload.phone&&r.phone===payload.phone)):null;
      if(!contact&&deal?.contact_id) contact=scoped(store.contacts,scope).find(r=>r.id===deal.contact_id)||null;
      if(!contact&&!hasContactInput) return json(res,400,{error:"new lead intake needs contact data; deal-only updates require an existing external_ref"});
      if(!contact){ contact={id:id("contact"),...payload,created_at:now(),updated_at:now()}; store.contacts.push(contact); }
      else if(hasContactInput) Object.assign(contact,payload,{updated_at:now()});
      if(dp){
        const pipeline=await getPipeline(store,scope); if(!dp.stage) dp.stage=pipeline.stages[0].label; if(!pipelineStage(pipeline,dp.stage)) return json(res,400,{error:`unknown pipeline stage: ${dp.stage}`});
        if(deal) Object.assign(deal,dp,{contact_id:contact.id,updated_at:now()}); else { deal={id:id("deal"),...dp,contact_id:contact.id,created_at:now(),updated_at:now()}; store.deals.push(deal); }
      }
      if(url.searchParams.get("dry_run")==="true") return json(res,200,{ok:true,dry_run:true,scope,contact_valid:true,deal_valid:Boolean(dp),external_ref:dp?.external_ref||""});
      const activity={id:id("activity"),...scope,contact_id:contact.id,deal_id:deal?.id||"",type:"lead_intake",note:cleanString(body.note||"Lead captured",1000),created_at:now(),updated_at:now()}; store.activities.push(activity);
      addAudit(store,scope,actor,"intake.received","contact",contact.id,{deal_id:deal?.id||""}); emitOutbox(store,scope,"crm.intake.received",{contact_id:contact.id,deal_id:deal?.id||"",external_ref:deal?.external_ref||""});
      runAutomations(store,scope,{type:"lead_intake",contact_id:contact.id,deal_id:deal?.id||"",stage:deal?.stage||""}); await writeStore(store); return json(res,201,{contact,deal});
    }

    const actor=await requireAccess(req,res,scope,"crm.read"); if(!actor) return;
    const store=await readStore();
    if(req.method==="GET"&&url.pathname==="/api/me") return json(res,200,{id:actor.id,name:actor.name,role:actor.role,scope,permissions:ROLE_PERMISSIONS[actor.role]||[]});
    if(req.method==="GET"&&url.pathname==="/api/summary") return json(res,200,summary(store,scope));
    if(req.method==="GET"&&url.pathname==="/api/insights") return json(res,200,insights(store,scope));

    if(url.pathname==="/api/contacts"){
      if(req.method==="GET") return json(res,200,{items:scoped(store.contacts,scope)});
      if(req.method==="POST"){
        if(!permissionAllowed(actor,"contacts.write")) return json(res,403,{error:"permission denied",required:"contacts.write"});
        const body=await readBody(req),payload=contactPayload(body,scope); if(!payload.name&&!payload.email&&!payload.phone&&!payload.company) return json(res,400,{error:"contact must include a name, email, phone or company"});
        const row={id:id("contact"),...payload,created_at:now(),updated_at:now()}; store.contacts.push(row); addAudit(store,scope,actor,"contact.created","contact",row.id); emitOutbox(store,scope,"crm.contact.created",{contact_id:row.id}); await writeStore(store); return json(res,201,row);
      }
      return json(res,405,{error:"method not allowed"});
    }

    if(url.pathname==="/api/deals"){
      if(req.method==="GET") return json(res,200,{items:scoped(store.deals,scope)});
      if(req.method==="POST"){
        if(!permissionAllowed(actor,"deals.write")) return json(res,403,{error:"permission denied",required:"deals.write"});
        const body=await readBody(req),payload=dealPayload(body,scope),pipeline=await getPipeline(store,scope); if(!payload.stage) payload.stage=pipeline.stages[0].label; if(!pipelineStage(pipeline,payload.stage)) return json(res,400,{error:`unknown pipeline stage: ${payload.stage}`});
        const row={id:id("deal"),...payload,created_at:now(),updated_at:now()}; store.deals.push(row); store.activities.push({id:id("activity"),...scope,contact_id:row.contact_id,deal_id:row.id,type:"deal_created",note:`Deal created in stage ${row.stage}`,created_at:now(),updated_at:now()}); addAudit(store,scope,actor,"deal.created","deal",row.id,{stage:row.stage}); emitOutbox(store,scope,"crm.deal.created",{deal_id:row.id,stage:row.stage}); runAutomations(store,scope,{type:"deal_created",deal_id:row.id,contact_id:row.contact_id,stage:row.stage}); await writeStore(store); return json(res,201,row);
      }
      return json(res,405,{error:"method not allowed"});
    }

    if(url.pathname.startsWith("/api/deals/")&&req.method==="PATCH"){
      if(!permissionAllowed(actor,"deals.write")) return json(res,403,{error:"permission denied",required:"deals.write"});
      const dealId=decodeURIComponent(url.pathname.slice("/api/deals/".length)),row=store.deals.find(d=>d.id===dealId&&d.entity_id===scope.entity_id&&d.platform_id===scope.platform_id); if(!row) return json(res,404,{error:"deal not found"});
      const body=await readBody(req),allowed=["title","value","currency","stage","owner","source","external_ref","next_action","next_action_due","contact_id"],previousStage=row.stage;
      if("stage" in body){ const pipeline=await getPipeline(store,scope); if(!pipelineStage(pipeline,body.stage)) return json(res,400,{error:`unknown pipeline stage: ${body.stage}`}); }
      for(const key of allowed) if(key in body) row[key]=key==="value"?Number(body[key]||0):cleanString(body[key],key==="next_action"?500:240); row.updated_at=now();
      if(body.stage&&body.stage!==previousStage){ store.activities.push({id:id("activity"),...scope,contact_id:row.contact_id,deal_id:row.id,type:"stage_changed",note:`${previousStage} → ${row.stage}`,created_at:now(),updated_at:now()}); emitOutbox(store,scope,"crm.deal.stage_changed",{deal_id:row.id,from_stage:previousStage,to_stage:row.stage}); runAutomations(store,scope,{type:"stage_changed",deal_id:row.id,contact_id:row.contact_id,from_stage:previousStage,to_stage:row.stage,stage:row.stage}); }
      addAudit(store,scope,actor,"deal.updated","deal",row.id,{from_stage:previousStage,to_stage:row.stage}); await writeStore(store); return json(res,200,row);
    }

    if(url.pathname==="/api/activities"){
      if(req.method==="GET") return json(res,200,{items:scoped(store.activities,scope)});
      if(req.method==="POST"){
        if(!permissionAllowed(actor,"activities.write")) return json(res,403,{error:"permission denied",required:"activities.write"});
        const body=await readBody(req),row={id:id("activity"),...scope,contact_id:cleanString(body.contact_id,120),deal_id:cleanString(body.deal_id,120),type:cleanString(body.type||"note",80),note:cleanString(body.note,2000),due_at:cleanString(body.due_at,40),completed:Boolean(body.completed),created_at:now(),updated_at:now()}; store.activities.push(row); addAudit(store,scope,actor,"activity.created","activity",row.id); runAutomations(store,scope,{type:"activity_created",activity_id:row.id,deal_id:row.deal_id,contact_id:row.contact_id,activity_type:row.type}); await writeStore(store); return json(res,201,row);
      }
      return json(res,405,{error:"method not allowed"});
    }

    if(url.pathname==="/api/pipeline"){
      if(req.method==="GET") return json(res,200,await getPipeline(store,scope));
      if(req.method==="PUT"){
        if(!permissionAllowed(actor,"pipeline.manage")) return json(res,403,{error:"permission denied",required:"pipeline.manage"});
        const body=validatePipelineInput(await readBody(req)); let row=scoped(store.pipelines,scope)[0];
        if(row) Object.assign(row,body,{updated_at:now()}); else { row={id:id("pipeline"),...scope,...body,is_default:false,created_at:now(),updated_at:now()}; store.pipelines.push(row); }
        const invalid=scoped(store.deals,scope).filter(d=>!pipelineStage(row,d.stage)); if(invalid.length) return json(res,409,{error:"pipeline update would orphan existing deal stages",deal_ids:invalid.slice(0,20).map(d=>d.id)});
        addAudit(store,scope,actor,"pipeline.updated","pipeline",row.id,{stages:row.stages.map(s=>s.label)}); emitOutbox(store,scope,"crm.pipeline.updated",{pipeline_id:row.id}); await writeStore(store); return json(res,200,row);
      }
      return json(res,405,{error:"method not allowed"});
    }

    if(url.pathname==="/api/automations"){
      if(req.method==="GET") return json(res,200,{items:scoped(store.automation_rules,scope)});
      if(req.method==="POST"){
        if(!permissionAllowed(actor,"automation.manage")) return json(res,403,{error:"permission denied",required:"automation.manage"});
        const body=await readBody(req),event=cleanString(body.event,80),supported=["lead_intake","deal_created","stage_changed","activity_created"]; if(!supported.includes(event)) return json(res,400,{error:"unsupported automation event",supported});
        const actions=Array.isArray(body.actions)?body.actions.slice(0,10):[]; if(!actions.length) return json(res,400,{error:"automation requires at least one action"});
        const row={id:id("rule"),...scope,name:cleanString(body.name||"Automation",160),enabled:body.enabled!==false,event,conditions:body.conditions&&typeof body.conditions==="object"?body.conditions:{},actions,created_at:now(),updated_at:now()}; store.automation_rules.push(row); addAudit(store,scope,actor,"automation.created","automation_rule",row.id); await writeStore(store); return json(res,201,row);
      }
      return json(res,405,{error:"method not allowed"});
    }
    if(url.pathname.startsWith("/api/automations/")&&req.method==="PATCH"){
      if(!permissionAllowed(actor,"automation.manage")) return json(res,403,{error:"permission denied",required:"automation.manage"});
      const ruleId=decodeURIComponent(url.pathname.slice("/api/automations/".length)),row=store.automation_rules.find(r=>r.id===ruleId&&r.entity_id===scope.entity_id&&r.platform_id===scope.platform_id); if(!row) return json(res,404,{error:"automation not found"});
      const body=await readBody(req); for(const key of ["name","enabled","conditions","actions"]) if(key in body) row[key]=key==="name"?cleanString(body[key],160):body[key]; row.updated_at=now(); addAudit(store,scope,actor,"automation.updated","automation_rule",row.id); await writeStore(store); return json(res,200,row);
    }

    if(url.pathname==="/api/integrations/outbox"){
      if(!permissionAllowed(actor,"integrations.manage")) return json(res,403,{error:"permission denied",required:"integrations.manage"});
      if(req.method==="GET") return json(res,200,{items:scoped(store.integration_outbox,scope).slice(-500)});
      return json(res,405,{error:"method not allowed"});
    }
    if(url.pathname.startsWith("/api/integrations/outbox/")&&url.pathname.endsWith("/ack")&&req.method==="POST"){
      if(!permissionAllowed(actor,"integrations.manage")) return json(res,403,{error:"permission denied",required:"integrations.manage"});
      const eventId=decodeURIComponent(url.pathname.slice("/api/integrations/outbox/".length,-4)),row=store.integration_outbox.find(e=>e.id===eventId&&e.entity_id===scope.entity_id&&e.platform_id===scope.platform_id); if(!row) return json(res,404,{error:"event not found"});
      row.status="acknowledged"; row.acknowledged_at=now(); row.updated_at=now(); addAudit(store,scope,actor,"integration.acknowledged","integration_event",row.id); await writeStore(store); return json(res,200,row);
    }

    if(req.method==="GET"&&url.pathname==="/api/audit"){
      if(!permissionAllowed(actor,"audit.read")) return json(res,403,{error:"permission denied",required:"audit.read"});
      return json(res,200,{items:scoped(store.audit,scope).slice(-1000).reverse()});
    }
    if(req.method==="GET"&&url.pathname==="/api/export"){
      if(!permissionAllowed(actor,"export.read")) return json(res,403,{error:"permission denied",required:"export.read"});
      return json(res,200,{exported_at:now(),scope,contacts:scoped(store.contacts,scope),deals:scoped(store.deals,scope),activities:scoped(store.activities,scope),pipeline:await getPipeline(store,scope),automation_rules:scoped(store.automation_rules,scope),audit:scoped(store.audit,scope)});
    }
    return json(res,404,{error:"not found"});
  } catch(error){ console.error(error); return json(res,error.status||500,{error:error.status?error.message:"internal server error"}); }
}

const server=http.createServer(handler);
server.listen(PORT,HOST,()=>console.log(`IZAKHONO CRM v0.2.0 listening on http://${HOST}:${PORT}`));
