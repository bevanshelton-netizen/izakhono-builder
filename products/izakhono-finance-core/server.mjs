import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const here=path.dirname(fileURLToPath(import.meta.url));
const HOST=process.env.HOST||"127.0.0.1";
const PORT=Number(process.env.PORT||8797);
const DATA_FILE=process.env.FINANCE_DATA_FILE||path.join(here,"finance-core.enc");
const ADMIN_TOKEN=String(process.env.FINANCE_ADMIN_TOKEN||"");
const INGEST_TOKEN=String(process.env.FINANCE_INGEST_TOKEN||"");
const ALLOW_LOCAL=process.env.FINANCE_ALLOW_INSECURE_LOCAL!=="false";
const MAKERS=parseTokenMap(process.env.FINANCE_MAKER_TOKENS_JSON||"{}","maker");
const CHECKERS=parseTokenMap(process.env.FINANCE_CHECKER_TOKENS_JSON||"{}","checker");
const KEY=await loadKey();
const EMPTY={loan_applications:[],accounts:[],payments:[],approvals:[],audit:[]};
let writes=Promise.resolve();

async function loadKey(){
  let raw=String(process.env.FINANCE_DATA_KEY_B64||"").trim();
  const file=String(process.env.FINANCE_DATA_KEY_FILE||"").trim();
  if(!raw&&file){try{raw=(await fs.readFile(file,"utf8")).trim()}catch{return null}}
  if(!raw)return null;
  try{const b=Buffer.from(raw,"base64");return b.length===32?b:null}catch{return null}
}
function parseTokenMap(raw,role){
  try{
    const parsed=JSON.parse(raw);const out=[];
    for(const [token,actor_id] of Object.entries(parsed||{})){
      const t=String(token||"").trim(),id=String(actor_id||"").trim();
      if(t&&id)out.push({token:t,id,role});
    }
    return out;
  }catch{return[]}
}
function now(){return new Date().toISOString()}
function uid(prefix){return prefix+"_"+crypto.randomUUID()}
function clean(v,max=300){return String(v??"").trim().slice(0,max)}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null}
function stable(v){
  if(Array.isArray(v))return"["+v.map(stable).join(",")+"]";
  if(v&&typeof v==="object")return"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+stable(v[k])).join(",")+"}";
  return JSON.stringify(v);
}
function sha(v){return crypto.createHash("sha256").update(typeof v==="string"?v:stable(v)).digest("hex")}
function scrub(v,depth=0){
  if(depth>4)return null;
  if(Array.isArray(v))return v.slice(0,50).map(x=>scrub(x,depth+1));
  if(v&&typeof v==="object"){
    const out={};for(const [k,val] of Object.entries(v).slice(0,100)){
      if(/password|secret|token|credential|card|cvv|pin|otp|raw_prompt/i.test(k))continue;
      out[clean(k,80)]=scrub(val,depth+1);
    }return out;
  }
  if(typeof v==="string")return clean(v,2000);
  if(typeof v==="number"||typeof v==="boolean"||v===null)return v;
  return clean(v,500);
}
function send(res,status,body){
  const data=JSON.stringify(body);
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(data),"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","permissions-policy":"camera=(), microphone=(), geolocation=()"});
  res.end(data);
}
function bearer(req){const v=String(req.headers.authorization||"");return v.startsWith("Bearer ")?v.slice(7):""}
function same(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function fromMap(token,map){for(const x of map)if(same(token,x.token))return{id:x.id,role:x.role};return null}
function actor(req,kind){
  const token=bearer(req);
  if(ADMIN_TOKEN&&same(token,ADMIN_TOKEN))return{id:"owner",role:"owner"};
  const checker=fromMap(token,CHECKERS);if(checker)return checker;
  const maker=fromMap(token,MAKERS);if(maker)return maker;
  if(kind==="ingest"&&INGEST_TOKEN&&same(token,INGEST_TOKEN))return{id:"integration",role:"integration"};
  if(!ADMIN_TOKEN&&!INGEST_TOKEN&&!MAKERS.length&&!CHECKERS.length&&ALLOW_LOCAL)return{id:"local-dev",role:"owner"};
  return null;
}
function requireRole(a,roles){return a&&roles.includes(a.role)}
function scope(req,url){
  const institution_id=clean(req.headers["x-institution-id"]||url.searchParams.get("institution"),120);
  const entity_id=clean(req.headers["x-entity-id"]||url.searchParams.get("entity"),120);
  return institution_id&&entity_id?{institution_id,entity_id}:null;
}
function scoped(rows,s){return rows.filter(r=>r.institution_id===s.institution_id&&r.entity_id===s.entity_id)}
async function body(req,limit=524288){
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error("body too large"),{status:413});chunks.push(chunk)}
  if(!chunks.length)return{};
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8"))}catch{throw Object.assign(new Error("invalid json"),{status:400})}
}
function encrypt(store){
  if(!KEY)throw Object.assign(new Error("encrypted persistence key not configured"),{status:503});
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",KEY,iv);
  const ct=Buffer.concat([cipher.update(JSON.stringify(store),"utf8"),cipher.final()]);
  return Buffer.from(JSON.stringify({v:1,alg:"A256GCM",iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),ct:ct.toString("base64")}));
}
function decrypt(buf){
  if(!KEY)throw Object.assign(new Error("encrypted persistence key not configured"),{status:503});
  const e=JSON.parse(buf.toString("utf8"));if(e.v!==1||e.alg!=="A256GCM")throw new Error("unsupported encrypted store format");
  const iv=Buffer.from(e.iv,"base64"),tag=Buffer.from(e.tag,"base64"),ct=Buffer.from(e.ct,"base64");
  const d=crypto.createDecipheriv("aes-256-gcm",KEY,iv);d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct),d.final()]).toString("utf8"));
}
function verifyAuditChain(rows){
  let prev="GENESIS";
  for(const row of rows){
    if(!row.prev_hash||!row.record_hash)return{valid:null,legacy:true,count:rows.length,head_hash:null};
    if(row.prev_hash!==prev)return{valid:false,legacy:false,count:rows.length,head_hash:prev};
    const copy={...row};delete copy.record_hash;
    const expected=sha(copy);if(expected!==row.record_hash)return{valid:false,legacy:false,count:rows.length,head_hash:prev};
    prev=row.record_hash;
  }
  return{valid:true,legacy:false,count:rows.length,head_hash:prev==="GENESIS"?null:prev};
}
function migrateLegacyAudit(store){
  const state=verifyAuditChain(store.audit);if(state.valid===false)throw Object.assign(new Error("audit chain invalid"),{status:500});
  if(!state.legacy)return;
  let prev="GENESIS";
  store.audit=store.audit.map(row=>{const next={...row,prev_hash:prev};next.record_hash=sha(next);prev=next.record_hash;return next});
}
function audit(store,s,a,action,target_type,target_id,detail={}){
  migrateLegacyAudit(store);
  const prev=store.audit.length?store.audit.at(-1).record_hash:"GENESIS";
  const row={id:uid("audit"),...s,actor_id:a.id,actor_role:a.role,action,target_type,target_id,detail:scrub(detail),created_at:now(),prev_hash:prev};
  row.record_hash=sha(row);store.audit.push(row);
  if(store.audit.length>50000)throw Object.assign(new Error("audit retention limit reached; archive required"),{status:507});
  return row;
}
async function readStore(){
  try{
    const x=decrypt(await fs.readFile(DATA_FILE));
    const store=Object.fromEntries(Object.keys(EMPTY).map(k=>[k,Array.isArray(x[k])?x[k]:[]]));
    const state=verifyAuditChain(store.audit);if(state.valid===false)throw Object.assign(new Error("audit chain invalid"),{status:500});
    return store;
  }catch(e){if(e.code==="ENOENT")return structuredClone(EMPTY);throw e}
}
async function writeStore(store){
  const integrity=verifyAuditChain(store.audit);if(integrity.valid===false)throw Object.assign(new Error("audit chain invalid"),{status:500});
  writes=writes.then(async()=>{await fs.mkdir(path.dirname(DATA_FILE),{recursive:true});const tmp=DATA_FILE+"."+process.pid+".tmp";await fs.writeFile(tmp,encrypt(store),{mode:0o600});await fs.rename(tmp,DATA_FILE)});
  return writes;
}
function approvalFor(store,s,id,action_type,target_id){
  return scoped(store.approvals,s).find(x=>x.id===id&&x.action_type===action_type&&x.target_id===target_id&&x.status==="approved")||null;
}
function capabilities(){
  return{
    service:"izakhono-finance-core",version:"0.2.0",engineIndependent:true,ownedFirst:true,
    capabilities:["loan origination","loan servicing records","savings/member account administration","payments ledger references","collections workflow","reporting","maker-checker approvals","hash-chained audit","encrypted persistence"],
    integrations:["FORTRESS","SUPER ACCOUNTANT","IZAKHONO CRM","FLOWIQ","IZAKHONO PAY","IZAKHONO SUPER AI advisory"],
    boundaries:{softwareVendorOnly:true,depositTaking:false,creditProvider:false,automatedFinalCreditDecision:false,moneyMovement:false},
    security:{makerChecker:true,auditHashChain:true,encryptedPersistence:Boolean(KEY),secretFileKeySupported:true},
    privacy:{tracking:false,profiling:false,advertisingIdentifiers:false}
  };
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://"+(req.headers.host||"localhost"));
    if(req.method==="GET"&&url.pathname==="/health")return send(res,200,{ok:true,...capabilities(),authConfigured:Boolean(ADMIN_TOKEN||INGEST_TOKEN||MAKERS.length||CHECKERS.length)});
    if(req.method==="GET"&&url.pathname==="/api/capabilities")return send(res,200,capabilities());
    if(req.method==="GET"&&(url.pathname==="/"||url.pathname==="/index.html")){
      const html=await fs.readFile(path.join(here,"public","index.html"),"utf8");
      res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","permissions-policy":"camera=(), microphone=(), geolocation=()"});return res.end(html);
    }
    if(!url.pathname.startsWith("/api/"))return send(res,404,{error:"not_found"});
    const s=scope(req,url);if(!s)return send(res,400,{error:"X-Institution-ID and X-Entity-ID are required"});
    const kind=req.method==="POST"?"ingest":"read";const a=actor(req,kind);if(!a)return send(res,401,{error:"unauthorized"});
    if(!KEY)return send(res,503,{error:"encrypted_persistence_not_configured",required:"FINANCE_DATA_KEY_B64 or FINANCE_DATA_KEY_FILE containing a 32-byte base64 key"});
    const store=await readStore();

    if(req.method==="POST"&&url.pathname==="/api/loan-applications"){
      if(!requireRole(a,["owner","maker","integration"]))return send(res,403,{error:"maker_or_integration_required"});
      const b=await body(req),amount=money(b.amount),term=Number(b.term_months);
      if(!clean(b.customer_ref,160)||!clean(b.product_ref,160)||amount===null||!Number.isInteger(term)||term<1||term>600)return send(res,400,{error:"customer_ref, product_ref, non-negative amount and term_months 1..600 required"});
      const row={id:uid("loan"),...s,customer_ref:clean(b.customer_ref,160),product_ref:clean(b.product_ref,160),amount,currency:clean(b.currency||"ZAR",8).toUpperCase(),term_months:term,status:"received",final_credit_decision:null,created_at:now(),updated_at:now()};
      store.loan_applications.push(row);audit(store,s,a,"loan_application.received","loan_application",row.id,{amount:row.amount,currency:row.currency});await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/loan-applications")return send(res,200,{items:scoped(store.loan_applications,s).slice(-500).reverse()});

    if(req.method==="POST"&&url.pathname==="/api/accounts"){
      if(!requireRole(a,["owner","maker","integration"]))return send(res,403,{error:"maker_or_integration_required"});
      const b=await body(req);if(!clean(b.customer_ref,160)||!clean(b.product_ref,160))return send(res,400,{error:"customer_ref and product_ref required"});
      const row={id:uid("acct"),...s,customer_ref:clean(b.customer_ref,160),product_ref:clean(b.product_ref,160),account_type:clean(b.account_type||"member",40),currency:clean(b.currency||"ZAR",8).toUpperCase(),status:"pending_authorisation",balance:0,deposit_taking_enabled:false,created_at:now(),updated_at:now()};
      store.accounts.push(row);audit(store,s,a,"account.requested","account",row.id);await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/accounts")return send(res,200,{items:scoped(store.accounts,s).slice(-500).reverse()});

    if(req.method==="POST"&&url.pathname.startsWith("/api/accounts/")&&url.pathname.endsWith("/activate-record")){
      if(!requireRole(a,["owner","checker"]))return send(res,403,{error:"checker_required"});
      const id=decodeURIComponent(url.pathname.slice("/api/accounts/".length,-"/activate-record".length));
      const account=scoped(store.accounts,s).find(x=>x.id===id);if(!account)return send(res,404,{error:"account_not_found"});
      const b=await body(req),approval=approvalFor(store,s,clean(b.approval_id,160),"account.activate-record",id);
      if(!approval)return send(res,422,{error:"approved_maker_checker_record_required"});
      if(approval.approved_by===approval.requested_by)return send(res,422,{error:"maker_checker_separation_invalid"});
      account.status="approved_software_record";account.updated_at=now();
      audit(store,s,a,"account.software_record_activated","account",id,{approval_id:approval.id,deposit_taking_enabled:false});await writeStore(store);return send(res,200,account);
    }

    if(req.method==="POST"&&url.pathname==="/api/payments/reference"){
      if(!requireRole(a,["owner","maker","integration"]))return send(res,403,{error:"maker_or_integration_required"});
      const b=await body(req),amount=money(b.amount);if(!clean(b.customer_ref,160)||!clean(b.external_payment_ref,200)||amount===null)return send(res,400,{error:"customer_ref, external_payment_ref and non-negative amount required"});
      const ext=clean(b.external_payment_ref,200),existing=scoped(store.payments,s).find(x=>x.external_payment_ref===ext);
      if(existing)return send(res,200,{...existing,idempotent_replay:true});
      const row={id:uid("payref"),...s,customer_ref:clean(b.customer_ref,160),external_payment_ref:ext,amount,currency:clean(b.currency||"ZAR",8).toUpperCase(),status:clean(b.status||"unverified",40),money_moved_by_finance_core:false,created_at:now()};
      store.payments.push(row);audit(store,s,a,"payment.reference_recorded","payment_reference",row.id,{amount:row.amount,currency:row.currency,status:row.status});await writeStore(store);return send(res,201,row);
    }

    if(req.method==="POST"&&url.pathname==="/api/approvals/request"){
      if(!requireRole(a,["owner","maker"]))return send(res,403,{error:"maker_required"});
      const b=await body(req),action_type=clean(b.action_type,120),target_type=clean(b.target_type,120),target_id=clean(b.target_id,180);
      if(!action_type||!target_type||!target_id)return send(res,400,{error:"action_type, target_type and target_id required"});
      const allowed=new Set(["account.activate-record","payment-adapter.enable","product-config.publish","institution-config.publish"]);
      if(!allowed.has(action_type))return send(res,422,{error:"approval_action_not_allowed"});
      const row={id:uid("approval"),...s,action_type,target_type,target_id,detail:scrub(b.detail||{}),status:"pending",requested_by:a.id,requested_role:a.role,requested_at:now(),approved_by:null,approved_at:null,rejected_by:null,rejected_at:null};
      store.approvals.push(row);audit(store,s,a,"approval.requested","approval",row.id,{action_type,target_type,target_id});await writeStore(store);return send(res,201,row);
    }
    if(req.method==="POST"&&url.pathname.startsWith("/api/approvals/")&&(url.pathname.endsWith("/approve")||url.pathname.endsWith("/reject"))){
      if(!requireRole(a,["owner","checker"]))return send(res,403,{error:"checker_required"});
      const approve=url.pathname.endsWith("/approve"),suffix=approve?"/approve":"/reject",id=decodeURIComponent(url.pathname.slice("/api/approvals/".length,-suffix.length));
      const row=scoped(store.approvals,s).find(x=>x.id===id);if(!row)return send(res,404,{error:"approval_not_found"});
      if(row.status!=="pending")return send(res,409,{error:"approval_already_decided",status:row.status});
      if(row.requested_by===a.id)return send(res,422,{error:"maker_checker_separation_required"});
      const b=await body(req);row.status=approve?"approved":"rejected";row.decision_note=clean(b.note,500);
      if(approve){row.approved_by=a.id;row.approved_at=now()}else{row.rejected_by=a.id;row.rejected_at=now()}
      audit(store,s,a,approve?"approval.approved":"approval.rejected","approval",row.id,{action_type:row.action_type,target_id:row.target_id});await writeStore(store);return send(res,200,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/approvals")return send(res,200,{items:scoped(store.approvals,s).slice(-1000).reverse()});

    if(req.method==="GET"&&url.pathname==="/api/summary"){
      const loans=scoped(store.loan_applications,s),accounts=scoped(store.accounts,s),payments=scoped(store.payments,s),approvals=scoped(store.approvals,s);
      return send(res,200,{scope:s,loan_applications:loans.length,accounts:accounts.length,payment_references:payments.length,pending_approvals:approvals.filter(x=>x.status==="pending").length,loan_value:loans.reduce((n,x)=>n+x.amount,0),privacy:{tracking:false,profiling:false},regulated_actions:{money_movement:false,deposit_taking:false,final_credit_decisions:false}});
    }
    if(req.method==="GET"&&url.pathname==="/api/audit/integrity")return send(res,200,verifyAuditChain(store.audit));
    if(req.method==="GET"&&url.pathname==="/api/audit")return send(res,200,{items:scoped(store.audit,s).slice(-1000).reverse(),integrity:verifyAuditChain(store.audit)});
    return send(res,404,{error:"not_found"});
  }catch(e){return send(res,e.status||500,{error:e.status?e.message:"internal_error"})}
});
server.listen(PORT,HOST,()=>{console.log("IZAKHONO_FINANCE_CORE=READY");console.log("FINANCE_CORE_PORT="+PORT);console.log("ENCRYPTED_PERSISTENCE="+(KEY?"CONFIGURED":"NOT_CONFIGURED"));console.log("MAKER_CHECKER="+(MAKERS.length&&CHECKERS.length?"CONFIGURED":"NOT_CONFIGURED"))});
