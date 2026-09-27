import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const here=path.dirname(fileURLToPath(import.meta.url));
const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8795);
const DATA_FILE=process.env.REVENUE_DATA_FILE||path.join(here,"revenue-data.json");
const FLOW_TOKEN=String(process.env.REVENUE_FLOW_TOKEN||"");
const ALLOW_LOCAL=process.env.REVENUE_ALLOW_INSECURE_LOCAL!=="false";
const EMPTY={quotes:[],invoices:[],receipts:[],audit:[]};
let writes=Promise.resolve();

const now=()=>new Date().toISOString();
const uid=p=>p+"_"+crypto.randomUUID();
const clean=(v,max=500)=>String(v??"").trim().slice(0,max);
const same=(a,b)=>{if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)};
const bearer=req=>{const v=String(req.headers.authorization||"");return v.startsWith("Bearer ")?v.slice(7):""};
const scope=(req,url)=>{const entity_id=clean(req.headers["x-entity-id"]||url.searchParams.get("entity"),120),platform_id=clean(req.headers["x-platform-id"]||url.searchParams.get("platform"),120);return entity_id&&platform_id?{entity_id,platform_id}:null};
const scoped=(rows,s)=>rows.filter(r=>r.entity_id===s.entity_id&&r.platform_id===s.platform_id);

function send(res,status,body){const data=JSON.stringify(body);res.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(data),"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});res.end(data)}
async function body(req,limit=512*1024){let n=0,ch=[];for await(const c of req){n+=c.length;if(n>limit)throw Object.assign(new Error("body too large"),{status:413});ch.push(c)}if(!ch.length)return{};try{return JSON.parse(Buffer.concat(ch).toString("utf8"))}catch{throw Object.assign(new Error("invalid json"),{status:400})}}
async function readStore(){try{const p=JSON.parse(await fs.readFile(DATA_FILE,"utf8"));return Object.fromEntries(Object.keys(EMPTY).map(k=>[k,Array.isArray(p[k])?p[k]:[]]))}catch(e){if(e.code==="ENOENT")return structuredClone(EMPTY);throw e}}
async function writeStore(store){writes=writes.then(async()=>{await fs.mkdir(path.dirname(DATA_FILE),{recursive:true});const tmp=DATA_FILE+"."+process.pid+".tmp";await fs.writeFile(tmp,JSON.stringify(store,null,2),{mode:0o600});await fs.rename(tmp,DATA_FILE)});return writes}
function authorized(req){if(FLOW_TOKEN)return same(bearer(req),FLOW_TOKEN);return ALLOW_LOCAL}
function money(payload){
  const m=payload?.metadata||{};
  const direct=Number(m.amount_minor);
  if(Number.isInteger(direct)&&direct>=0)return direct;
  const value=Number(m.value);
  if(Number.isFinite(value)&&value>=0)return Math.round(value*100);
  return null;
}
function currency(payload){return clean(payload?.metadata?.currency||"ZAR",8).toUpperCase()}
function audit(store,s,action,target,id,detail={}){store.audit.push({id:uid("audit"),...s,action,target,target_id:id,detail,created_at:now()});if(store.audit.length>10000)store.audit.splice(0,store.audit.length-10000)}

async function handleFlow(req,res,s){
  if(!authorized(req))return send(res,401,{error:"unauthorized"});
  const input=await body(req),action_id=clean(input.action_id,180),run_id=clean(input.run_id,180),action_type=clean(input.action_type,120),payload=input.payload&&typeof input.payload==="object"?input.payload:{};
  if(!action_id||!run_id||!action_type)return send(res,400,{error:"action_id, run_id and action_type are required"});
  const store=await readStore(),existing=scoped(store.receipts,s).find(r=>r.action_id===action_id);
  if(existing)return send(res,200,{ok:true,idempotent_replay:true,receipt:existing});
  const subject_ref=clean(payload.subject_ref,200);
  let result=null;
  if(action_type==="quote.prepare.requested"){
    const amount_minor=money(payload);
    const row={id:uid("quote"),...s,run_id,action_id,subject_ref,currency:currency(payload),amount_minor,status:"draft",requires_pricing:amount_minor===null,created_at:now(),updated_at:now()};
    store.quotes.push(row);result={type:"quote",record:row};
  }else if(action_type==="invoice.issue.requested"){
    const linked=[...scoped(store.quotes,s)].reverse().find(q=>q.subject_ref===subject_ref)||null;
    const amount_minor=money(payload)??linked?.amount_minor??null;
    const row={id:uid("invoice"),...s,run_id,action_id,subject_ref,quote_id:linked?.id||"",currency:currency(payload)||linked?.currency||"ZAR",amount_minor,status:"draft",requires_amount:amount_minor===null,created_at:now(),updated_at:now()};
    store.invoices.push(row);result={type:"invoice",record:row};
  }else{
    return send(res,400,{error:"unsupported_flow_action",supported:["quote.prepare.requested","invoice.issue.requested"]});
  }
  const receipt={id:uid("rcpt"),...s,action_id,run_id,action_type,result_type:result.type,result_id:result.record.id,created_at:now()};
  store.receipts.push(receipt);audit(store,s,"flow.action.accepted",result.type,result.record.id,{action_id,run_id,action_type});await writeStore(store);
  return send(res,201,{ok:true,receipt,...result});
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://"+(req.headers.host||"localhost"));
    if(req.method==="GET"&&url.pathname==="/health")return send(res,200,{ok:true,service:"izakhono-revenue",version:"0.2.0",engineIndependent:true,paymentAuthority:false});
    const s=scope(req,url);if(!s)return send(res,400,{error:"X-Entity-ID and X-Platform-ID are required"});
    if(req.method==="POST"&&url.pathname==="/api/flow")return handleFlow(req,res,s);
    if(!authorized(req))return send(res,401,{error:"unauthorized"});
    const store=await readStore();
    if(req.method==="GET"&&url.pathname==="/api/quotes")return send(res,200,{items:scoped(store.quotes,s)});
    if(req.method==="GET"&&url.pathname==="/api/invoices")return send(res,200,{items:scoped(store.invoices,s)});
    if(req.method==="GET"&&url.pathname==="/api/audit")return send(res,200,{items:scoped(store.audit,s).slice(-1000).reverse()});
    return send(res,404,{error:"not_found"});
  }catch(e){console.error(e);return send(res,e.status||500,{error:e.status?e.message:"internal_error"})}
});
server.listen(PORT,HOST,()=>console.log("IZAKHONO_REVENUE=READY port="+PORT));
