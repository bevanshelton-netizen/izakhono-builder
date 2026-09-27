import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const here=path.dirname(fileURLToPath(import.meta.url));
const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8794);
const DATA_FILE=process.env.FLOW_DATA_FILE||path.join(here,"flow-data.json");
const ADMIN_TOKEN=String(process.env.FLOW_ADMIN_TOKEN||"");
const INGEST_TOKEN=String(process.env.FLOW_INGEST_TOKEN||"");
const ALLOW_LOCAL=process.env.FLOW_ALLOW_INSECURE_LOCAL!=="false";
const ADAPTERS=parseJson(process.env.FLOW_ADAPTERS_JSON||"{}",{});
const EMPTY={runs:[],events:[],action_outbox:[],audit:[]};
const STAGES=["lead","qualified","quoted","awaiting_payment","paid","fulfilment","invoiced","support","retained","closed"];
const EVENT_STAGE={
  "lead.created":"lead","lead.qualified":"qualified","quote.requested":"qualified","quote.prepared":"quoted","quote.sent":"quoted",
  "checkout.started":"awaiting_payment","payment.confirmed":"paid","fulfilment.started":"fulfilment","fulfilment.completed":"fulfilment",
  "invoice.issued":"invoiced","support.opened":"support","support.resolved":"retained","renewal.due":"retained",
  "renewal.completed":"retained","customer.won":"retained","customer.lost":"closed"
};
const ACTIONS={
  "lead.created":[["izakhono-crm","crm.intake.requested"]],
  "lead.qualified":[["izakhono-revenue","quote.prepare.requested"]],
  "quote.requested":[["izakhono-revenue","quote.prepare.requested"]],
  "quote.sent":[["izakhono-tasks","followup.schedule.requested"]],
  "checkout.started":[["izakhono-pay","payment.status.watch.requested"]],
  "payment.confirmed":[["platform","fulfilment.start.requested"],["izakhono-crm","crm.payment.confirmed"]],
  "fulfilment.completed":[["izakhono-revenue","invoice.issue.requested"],["izakhono-crm","crm.fulfilment.completed"]],
  "invoice.issued":[["izakhono-tasks","retention.followup.schedule.requested"]],
  "support.opened":[["izakhono-tasks","support.followup.schedule.requested"]],
  "renewal.due":[["izakhono-tasks","renewal.followup.schedule.requested"]],
  "ai.suggestion.requested":[["izakhono-super-ai","advisory.suggestion.requested"]]
};
let writes=Promise.resolve();

function parseJson(raw,fallback){try{return JSON.parse(raw)}catch{return fallback}}
function now(){return new Date().toISOString()}
function uid(prefix){return prefix+"_"+crypto.randomUUID()}
function clean(v,max=500){return String(v??"").trim().slice(0,max)}
function scrub(v,depth=0){
  if(depth>4)return null;
  if(Array.isArray(v))return v.slice(0,50).map(x=>scrub(x,depth+1));
  if(v&&typeof v==="object"){
    const out={};
    for(const [k,val] of Object.entries(v).slice(0,100)){
      if(/password|secret|token|credential|card|cvv|fraud_signal|raw_prompt/i.test(k))continue;
      out[clean(k,80)]=scrub(val,depth+1);
    }
    return out;
  }
  if(typeof v==="string")return clean(v,2000);
  if(typeof v==="number"||typeof v==="boolean"||v===null)return v;
  return clean(v,500);
}
function scrubAdvisory(v,depth=0){
  if(depth>4)return null;
  if(Array.isArray(v))return v.slice(0,30).map(x=>scrubAdvisory(x,depth+1));
  if(v&&typeof v==="object"){
    const out={};
    for(const [k,val] of Object.entries(v).slice(0,80)){
      if(/password|secret|token|credential|card|cvv|fraud|raw_prompt|contact|email|phone|mobile|name|address|identity|id_number|passport|bank|account/i.test(k))continue;
      out[clean(k,80)]=scrubAdvisory(val,depth+1);
    }
    return out;
  }
  if(typeof v==="string")return clean(v,1200);
  if(typeof v==="number"||typeof v==="boolean"||v===null)return v;
  return clean(v,300);
}
function send(res,status,body){
  const data=JSON.stringify(body);
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(data),"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});
  res.end(data);
}
function sendText(res,status,body,type){
  res.writeHead(status,{"content-type":type||"text/plain; charset=utf-8","content-length":Buffer.byteLength(body),"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});
  res.end(body);
}
function bearer(req){const v=String(req.headers.authorization||"");return v.startsWith("Bearer ")?v.slice(7):""}
function same(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function scope(req,url){
  const entity_id=clean(req.headers["x-entity-id"]||url.searchParams.get("entity"),120);
  const platform_id=clean(req.headers["x-platform-id"]||url.searchParams.get("platform"),120);
  return entity_id&&platform_id?{entity_id,platform_id}:null;
}
function rowsFor(rows,s){return rows.filter(r=>r.entity_id===s.entity_id&&r.platform_id===s.platform_id)}
async function body(req,limit=1048576){
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error("body too large"),{status:413});chunks.push(chunk)}
  if(!chunks.length)return{};
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8"))}catch{throw Object.assign(new Error("invalid json"),{status:400})}
}
async function readStore(){
  try{const parsed=JSON.parse(await fs.readFile(DATA_FILE,"utf8"));return Object.fromEntries(Object.keys(EMPTY).map(k=>[k,Array.isArray(parsed[k])?parsed[k]:[]]))}
  catch(e){if(e.code==="ENOENT")return structuredClone(EMPTY);throw e}
}
async function writeStore(store){
  writes=writes.then(async()=>{await fs.mkdir(path.dirname(DATA_FILE),{recursive:true});const tmp=DATA_FILE+"."+process.pid+".tmp";await fs.writeFile(tmp,JSON.stringify(store,null,2),{mode:0o600});await fs.rename(tmp,DATA_FILE)});
  return writes;
}
function actor(req,kind){
  const token=bearer(req);
  if(ADMIN_TOKEN&&same(token,ADMIN_TOKEN))return{id:"owner",role:"owner"};
  if(kind==="ingest"&&INGEST_TOKEN&&same(token,INGEST_TOKEN))return{id:"integration",role:"integration"};
  if(!ADMIN_TOKEN&&!INGEST_TOKEN&&ALLOW_LOCAL)return{id:"local-dev",role:"owner"};
  return null;
}
function requireActor(req,res,kind){
  const a=actor(req,kind||"read");
  if(!a){send(res,401,{error:"unauthorized"});return null}
  return a;
}
function addAudit(store,s,a,action,target_type,target_id,detail){
  store.audit.push({id:uid("audit"),...s,actor_id:a?.id||"system",actor_role:a?.role||"system",action,target_type,target_id,detail:scrub(detail||{}),created_at:now()});
  if(store.audit.length>10000)store.audit.splice(0,store.audit.length-10000);
}
function validPayment(e){
  if(e.event_type!=="payment.confirmed")return true;
  return e.source_service==="izakhono-pay"&&e.verification?.status==="verified"&&Boolean(e.references?.payment_intent_id||e.references?.payment_reference);
}
function findRun(store,s,key,subject){
  return rowsFor(store.runs,s).filter(r=>r.workflow_key===key&&r.subject_ref===subject&&r.status!=="closed").sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)))[0]||null;
}
function advance(store,s,e){
  const key=clean(e.workflow_key||"lead-to-cash",120);
  let run=findRun(store,s,key,e.subject_ref);
  if(!run){run={id:uid("run"),...s,workflow_key:key,subject_ref:e.subject_ref,stage:"lead",status:"active",last_event_type:"",created_at:now(),updated_at:now()};store.runs.push(run)}
  const next=EVENT_STAGE[e.event_type]||run.stage;
  const oldI=STAGES.indexOf(run.stage),newI=STAGES.indexOf(next);
  if(newI>=0&&(oldI<0||newI>=oldI))run.stage=next;
  if(e.event_type==="customer.lost"||e.event_type==="workflow.closed")run.status="closed";
  run.last_event_type=e.event_type;run.updated_at=now();return run;
}
function enqueue(store,s,run,e,target,type){
  const row={id:uid("act"),...s,run_id:run.id,event_id:e.id,target,action_type:type,payload:scrub({event_type:e.event_type,subject_ref:e.subject_ref,source_service:e.source_service,references:e.references,metadata:e.metadata,run_stage:run.stage}),status:"pending",attempts:0,last_error:"",created_at:now(),updated_at:now()};
  store.action_outbox.push(row);return row;
}
function adapterRequest(row,cfg,endpoint){
  const headers={"content-type":"application/json","x-entity-id":row.entity_id,"x-platform-id":row.platform_id};
  if(cfg?.kind==="super-ai-workflow"){
    const internalKey=clean(cfg.internal_key,2000),workflowKey=clean(cfg.workflow_key,2000);
    if(!internalKey||!workflowKey)return{error:"super_ai_credentials_missing"};
    headers["x-izakhono-ai-key"]=internalKey;
    headers["x-izakhono-ai-workflow-key"]=workflowKey;
    const advisoryContext={
      platform_id:row.platform_id,
      run_stage:clean(row.payload?.run_stage,80),
      event_type:clean(row.payload?.event_type,120),
      metadata:scrubAdvisory(row.payload?.metadata||{})
    };
    const requestBody={
      entity_id:row.entity_id,
      subject:`flow:${row.platform_id}:${row.run_id}`,
      product:clean(cfg.product||"izakhono-flow",120),
      access_mode:"workflow",
      capability:clean(cfg.capability||"reasoning",40),
      route:"owned",
      data_classification:"internal",
      messages:[
        {role:"system",content:"You are the advisory intelligence layer for IZAKHONO FLOW. Return a concise, reversible next-step recommendation. Do not move money, confirm payment, make a regulated decision, or send a customer communication."},
        {role:"user",content:JSON.stringify(advisoryContext)}
      ]
    };
    return{headers,body:requestBody};
  }
  const token=typeof cfg==="object"?clean(cfg.token,2000):"";
  if(token)headers.authorization="Bearer "+token;
  return{headers,body:{action_id:row.id,run_id:row.run_id,action_type:row.action_type,payload:row.payload}};
}
async function dispatch(row){
  const cfg=ADAPTERS[row.target];if(!cfg)return{ok:false,error:"adapter_not_configured"};
  const endpoint=typeof cfg==="string"?cfg:cfg?.url;if(!endpoint)return{ok:false,error:"adapter_url_missing"};
  const request=adapterRequest(row,typeof cfg==="object"?cfg:{},endpoint);
  if(request.error)return{ok:false,error:request.error};
  try{
    const r=await fetch(endpoint,{method:"POST",headers:request.headers,body:JSON.stringify(request.body),signal:AbortSignal.timeout(Number(cfg?.timeout_ms||15000))});
    let data=null;try{data=await r.json()}catch{}
    return{ok:r.ok,status:r.status,body:data};
  }catch(e){return{ok:false,error:clean(e.message,500)}}
}
async function autoDispatchConfigured(store,s,actions,a){
  const deliveries=[];
  for(const row of actions){
    if(!ADAPTERS[row.target]) continue;
    row.attempts+=1;row.updated_at=now();
    const result=await dispatch(row);
    row.status=result.ok?"completed":"failed";
    row.last_error=result.ok?"":clean(result.error||("HTTP "+(result.status||"error")),500);
    addAudit(store,s,a,"action.auto_dispatched","action",row.id,{target:row.target,status:row.status,http_status:result.status||null});
    deliveries.push({action_id:row.id,target:row.target,status:row.status,http_status:result.status||null});
  }
  if(deliveries.length) await writeStore(store);
  return deliveries;
}
function summary(store,s){
  const runs=rowsFor(store.runs,s),events=rowsFor(store.events,s),out=rowsFor(store.action_outbox,s),by_stage={};
  for(const r of runs)by_stage[r.stage]=(by_stage[r.stage]||0)+1;
  return{scope:s,active_runs:runs.filter(r=>r.status==="active").length,closed_runs:runs.filter(r=>r.status==="closed").length,events:events.length,pending_actions:out.filter(a=>a.status==="pending").length,failed_actions:out.filter(a=>a.status==="failed").length,by_stage,privacy:{tracking:false,profiling:false,advertisingIdentifiers:false}};
}
function capabilities(){
  return{service:"izakhono-flow",version:"0.2.0",workflow:"Lead -> Qualify -> Quote -> Pay -> Fulfil -> Invoice -> Support -> Retain -> Report",stages:STAGES,event_types:Object.keys(EVENT_STAGE),adapters:["izakhono-crm","izakhono-revenue","izakhono-pay","izakhono-tasks","izakhono-super-ai","platform"],guarantees:["entity_id + platform_id isolation","payment.confirmed accepted only from verified IZAKHONO PAY events","protected secrets filtered from orchestration metadata","AI actions advisory only","external adapters replaceable"]};
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://"+(req.headers.host||"localhost"));
    if(req.method==="GET"&&url.pathname==="/health")return send(res,200,{ok:true,service:"izakhono-flow",version:"0.2.0",engineIndependent:true,noTracking:true,adapterTargets:Object.keys(ADAPTERS)});
    if(req.method==="GET"&&url.pathname==="/api/capabilities")return send(res,200,capabilities());
    if(!url.pathname.startsWith("/api/")){
      if(url.pathname==="/"||url.pathname==="/index.html")return sendText(res,200,await fs.readFile(path.join(here,"public","index.html"),"utf8"),"text/html; charset=utf-8");
      return send(res,404,{error:"not_found"});
    }
    const s=scope(req,url);if(!s)return send(res,400,{error:"X-Entity-ID and X-Platform-ID are required"});
    if(req.method==="POST"&&url.pathname==="/api/events"){
      const a=requireActor(req,res,"ingest");if(!a)return;
      const b=await body(req);
      const e={id:uid("evt"),...s,event_type:clean(b.event_type,120),workflow_key:clean(b.workflow_key||"lead-to-cash",120),subject_ref:clean(b.subject_ref||b.external_ref,200),source_service:clean(b.source_service||s.platform_id,120),verification:scrub(b.verification||{}),references:scrub(b.references||{}),metadata:scrub(b.metadata||{}),created_at:now()};
      if(!e.event_type||!e.subject_ref)return send(res,400,{error:"event_type and subject_ref are required"});
      if(!validPayment(e))return send(res,422,{error:"unverified_payment_event",required:"source_service=izakhono-pay, verification.status=verified, payment reference"});
      const store=await readStore();store.events.push(e);const run=advance(store,s,e);const actions=(ACTIONS[e.event_type]||[]).map(([target,type])=>enqueue(store,s,run,e,target,type));
      addAudit(store,s,a,"event.accepted","event",e.id,{event_type:e.event_type,run_id:run.id,actions:actions.map(x=>x.id)});await writeStore(store);const deliveries=await autoDispatchConfigured(store,s,actions,a);return send(res,201,{event:e,run,actions,deliveries});
    }
    const a=requireActor(req,res,"read");if(!a)return;
    const store=await readStore();
    if(req.method==="GET"&&url.pathname==="/api/summary")return send(res,200,summary(store,s));
    if(req.method==="GET"&&url.pathname==="/api/runs")return send(res,200,{items:rowsFor(store.runs,s)});
    if(req.method==="GET"&&url.pathname.startsWith("/api/runs/")){
      const rid=decodeURIComponent(url.pathname.slice("/api/runs/".length));const run=rowsFor(store.runs,s).find(r=>r.id===rid);if(!run)return send(res,404,{error:"run_not_found"});
      return send(res,200,{run,events:rowsFor(store.events,s).filter(e=>e.subject_ref===run.subject_ref&&e.workflow_key===run.workflow_key),actions:rowsFor(store.action_outbox,s).filter(x=>x.run_id===run.id)});
    }
    if(req.method==="GET"&&url.pathname==="/api/events")return send(res,200,{items:rowsFor(store.events,s).slice(-500).reverse()});
    if(req.method==="GET"&&url.pathname==="/api/outbox")return send(res,200,{items:rowsFor(store.action_outbox,s)});
    if(req.method==="POST"&&url.pathname.startsWith("/api/outbox/")&&url.pathname.endsWith("/ack")){
      const id=decodeURIComponent(url.pathname.slice("/api/outbox/".length,-4));const row=rowsFor(store.action_outbox,s).find(x=>x.id===id);if(!row)return send(res,404,{error:"action_not_found"});
      const b=await body(req);row.status=b.status==="failed"?"failed":"completed";row.last_error=clean(b.error,500);row.updated_at=now();addAudit(store,s,a,"action.acknowledged","action",row.id,{status:row.status});await writeStore(store);return send(res,200,row);
    }
    if(req.method==="POST"&&url.pathname.startsWith("/api/outbox/")&&url.pathname.endsWith("/dispatch")){
      if(a.role!=="owner")return send(res,403,{error:"owner_required"});
      const id=decodeURIComponent(url.pathname.slice("/api/outbox/".length,-9));const row=rowsFor(store.action_outbox,s).find(x=>x.id===id);if(!row)return send(res,404,{error:"action_not_found"});
      row.attempts+=1;row.updated_at=now();const result=await dispatch(row);row.status=result.ok?"completed":"failed";row.last_error=result.ok?"":clean(result.error||("HTTP "+(result.status||"error")),500);addAudit(store,s,a,"action.dispatched","action",row.id,{target:row.target,status:row.status,http_status:result.status||null});await writeStore(store);return send(res,result.ok?200:502,{action:row,result});
    }
    if(req.method==="GET"&&url.pathname==="/api/audit")return send(res,200,{items:rowsFor(store.audit,s).slice(-1000).reverse()});
    return send(res,404,{error:"not_found"});
  }catch(e){return send(res,e.status||500,{error:e.status?e.message:"internal_error"})}
});
server.listen(PORT,HOST,()=>{console.log("IZAKHONO_FLOW=READY");console.log("FLOW_PORT="+PORT);console.log("FLOW_ADAPTERS="+(Object.keys(ADAPTERS).join(",")||"NONE_CONFIGURED"))});
