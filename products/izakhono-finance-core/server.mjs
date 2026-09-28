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
const EMPTY={
  institution_configs:[],
  product_configs:[],
  loan_applications:[],
  servicing_loans:[],
  repayment_allocations:[],
  collection_cases:[],
  accounts:[],
  payments:[],
  approvals:[],
  audit:[]
};
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
function percent(v){const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=100?Math.round(n*1000000)/1000000:null}
function isoDate(v){
  const s=clean(v,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
  const d=new Date(s+"T00:00:00Z");
  return Number.isNaN(d.getTime())?null:s;
}
function addMonths(dateString,n){
  const d=new Date(dateString+"T00:00:00Z");const day=d.getUTCDate();
  d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last));
  return d.toISOString().slice(0,10);
}
function buildSchedule({principal,annual_rate,term_months,start_date,method}){
  const rate=annual_rate/100/12;const rows=[];let balance=principal;
  const instalment=method==="flat"
    ? Math.round(((principal+(principal*(annual_rate/100)*(term_months/12)))/term_months)*100)/100
    : rate===0
      ? Math.round((principal/term_months)*100)/100
      : Math.round((principal*(rate*Math.pow(1+rate,term_months))/(Math.pow(1+rate,term_months)-1))*100)/100;
  for(let i=1;i<=term_months;i++){
    const interest=method==="flat"
      ? Math.round((principal*(annual_rate/100)/12)*100)/100
      : Math.round((balance*rate)*100)/100;
    let principal_due=Math.round((instalment-interest)*100)/100;
    if(i===term_months)principal_due=Math.round(balance*100)/100;
    const total_due=Math.round((principal_due+interest)*100)/100;
    balance=Math.max(0,Math.round((balance-principal_due)*100)/100);
    rows.push({number:i,due_date:addMonths(start_date,i),principal_due,interest_due:interest,total_due,paid_amount:0,status:"scheduled"});
  }
  return rows;
}
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
    service:"izakhono-finance-core",version:"0.3.0",engineIndependent:true,ownedFirst:true,
    capabilities:["institution configuration","white-label configuration","loan product configuration","loan origination","repayment schedule generation","loan servicing records","repayment reference allocation","arrears views","collections case records","savings/member account administration","payments ledger references","reporting","maker-checker approvals","hash-chained audit","encrypted persistence"],
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


    if(req.method==="POST"&&url.pathname==="/api/institution-configs"){
      if(!requireRole(a,["owner","maker"]))return send(res,403,{error:"maker_required"});
      const b=await body(req),name=clean(b.display_name,160);
      if(!name)return send(res,400,{error:"display_name required"});
      const row={id:uid("instcfg"),...s,display_name:name,short_name:clean(b.short_name||name,80),country_code:clean(b.country_code||"ZA",3).toUpperCase(),currency:clean(b.currency||"ZAR",8).toUpperCase(),locale:clean(b.locale||"en-ZA",20),brand:scrub(b.brand||{}),status:"draft",created_by:a.id,created_at:now(),updated_at:now()};
      store.institution_configs.push(row);audit(store,s,a,"institution_config.created","institution_config",row.id,{display_name:row.display_name});await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/institution-configs")return send(res,200,{items:scoped(store.institution_configs,s).slice(-100).reverse()});
    if(req.method==="POST"&&url.pathname.startsWith("/api/institution-configs/")&&url.pathname.endsWith("/publish")){
      if(!requireRole(a,["owner","checker"]))return send(res,403,{error:"checker_required"});
      const id=decodeURIComponent(url.pathname.slice("/api/institution-configs/".length,-"/publish".length));
      const row=scoped(store.institution_configs,s).find(x=>x.id===id);if(!row)return send(res,404,{error:"institution_config_not_found"});
      const b=await body(req),approval=approvalFor(store,s,clean(b.approval_id,160),"institution-config.publish",id);
      if(!approval)return send(res,422,{error:"approved_maker_checker_record_required"});
      row.status="published";row.published_at=now();row.updated_at=now();
      audit(store,s,a,"institution_config.published","institution_config",id,{approval_id:approval.id});await writeStore(store);return send(res,200,row);
    }

    if(req.method==="POST"&&url.pathname==="/api/product-configs"){
      if(!requireRole(a,["owner","maker"]))return send(res,403,{error:"maker_required"});
      const b=await body(req),name=clean(b.name,160),annual=percent(b.annual_rate),term=Number(b.default_term_months||0);
      const method=clean(b.interest_method||"declining",20);
      if(!name||annual===null||!Number.isInteger(term)||term<1||term>600||!["declining","flat"].includes(method))return send(res,400,{error:"name, annual_rate 0..100, default_term_months 1..600 and interest_method declining|flat required"});
      const row={id:uid("product"),...s,name,product_code:clean(b.product_code||name.toLowerCase().replace(/[^a-z0-9]+/g,"-"),80),currency:clean(b.currency||"ZAR",8).toUpperCase(),annual_rate:annual,interest_method:method,default_term_months:term,min_amount:money(b.min_amount??0),max_amount:money(b.max_amount??0),fees:scrub(b.fees||[]),status:"draft",decisioning:false,created_by:a.id,created_at:now(),updated_at:now()};
      if(row.min_amount===null||row.max_amount===null||row.max_amount<row.min_amount)return send(res,400,{error:"valid min_amount/max_amount required"});
      store.product_configs.push(row);audit(store,s,a,"product_config.created","product_config",row.id,{name:row.name,annual_rate:row.annual_rate});await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/product-configs")return send(res,200,{items:scoped(store.product_configs,s).slice(-500).reverse()});
    if(req.method==="POST"&&url.pathname.startsWith("/api/product-configs/")&&url.pathname.endsWith("/publish")){
      if(!requireRole(a,["owner","checker"]))return send(res,403,{error:"checker_required"});
      const id=decodeURIComponent(url.pathname.slice("/api/product-configs/".length,-"/publish".length));
      const row=scoped(store.product_configs,s).find(x=>x.id===id);if(!row)return send(res,404,{error:"product_config_not_found"});
      const b=await body(req),approval=approvalFor(store,s,clean(b.approval_id,160),"product-config.publish",id);
      if(!approval)return send(res,422,{error:"approved_maker_checker_record_required"});
      row.status="published";row.published_at=now();row.updated_at=now();
      audit(store,s,a,"product_config.published","product_config",id,{approval_id:approval.id});await writeStore(store);return send(res,200,row);
    }

    if(req.method==="POST"&&url.pathname==="/api/loan-applications"){
      if(!requireRole(a,["owner","maker","integration"]))return send(res,403,{error:"maker_or_integration_required"});
      const b=await body(req),amount=money(b.amount),term=Number(b.term_months);
      if(!clean(b.customer_ref,160)||!clean(b.product_ref,160)||amount===null||!Number.isInteger(term)||term<1||term>600)return send(res,400,{error:"customer_ref, product_ref, non-negative amount and term_months 1..600 required"});
      const product=scoped(store.product_configs,s).find(x=>x.id===clean(b.product_ref,160)||x.product_code===clean(b.product_ref,160));
      const row={id:uid("loan"),...s,customer_ref:clean(b.customer_ref,160),product_ref:clean(b.product_ref,160),amount,currency:clean(b.currency||product?.currency||"ZAR",8).toUpperCase(),term_months:term,status:"received",product_snapshot:product?scrub({id:product.id,name:product.name,annual_rate:product.annual_rate,interest_method:product.interest_method,status:product.status}):null,final_credit_decision:null,created_at:now(),updated_at:now()};
      store.loan_applications.push(row);audit(store,s,a,"loan_application.received","loan_application",row.id,{amount:row.amount,currency:row.currency});await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/loan-applications")return send(res,200,{items:scoped(store.loan_applications,s).slice(-500).reverse()});

    if(req.method==="POST"&&url.pathname==="/api/servicing-loans"){
      if(!requireRole(a,["owner","checker"]))return send(res,403,{error:"checker_required"});
      const b=await body(req),application=scoped(store.loan_applications,s).find(x=>x.id===clean(b.application_id,180));
      if(!application)return send(res,404,{error:"loan_application_not_found"});
      const approval=approvalFor(store,s,clean(b.approval_id,160),"loan-record.activate",application.id);
      if(!approval)return send(res,422,{error:"approved_maker_checker_record_required"});
      const product=scoped(store.product_configs,s).find(x=>x.id===application.product_ref||x.product_code===application.product_ref);
      if(!product||product.status!=="published")return send(res,422,{error:"published_product_config_required"});
      const start=isoDate(b.start_date);if(!start)return send(res,400,{error:"start_date YYYY-MM-DD required"});
      if(scoped(store.servicing_loans,s).some(x=>x.application_id===application.id))return send(res,409,{error:"servicing_record_already_exists"});
      const schedule=buildSchedule({principal:application.amount,annual_rate:product.annual_rate,term_months:application.term_months,start_date:start,method:product.interest_method});
      const total_due=Math.round(schedule.reduce((n,x)=>n+x.total_due,0)*100)/100;
      const row={id:uid("svc"),...s,application_id:application.id,customer_ref:application.customer_ref,product_ref:product.id,principal:application.amount,currency:application.currency,annual_rate:product.annual_rate,interest_method:product.interest_method,term_months:application.term_months,start_date:start,schedule,status:"active_software_record",principal_disbursed_by_finance_core:false,total_due,total_allocated:0,created_at:now(),updated_at:now()};
      store.servicing_loans.push(row);application.status="servicing_record_created";application.updated_at=now();
      audit(store,s,a,"servicing_loan.created","servicing_loan",row.id,{application_id:application.id,approval_id:approval.id,total_due});await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/servicing-loans")return send(res,200,{items:scoped(store.servicing_loans,s).slice(-500).reverse()});
    if(req.method==="GET"&&url.pathname.startsWith("/api/servicing-loans/")&&!url.pathname.endsWith("/allocate-repayment")){
      const id=decodeURIComponent(url.pathname.slice("/api/servicing-loans/".length));const row=scoped(store.servicing_loans,s).find(x=>x.id===id);
      if(!row)return send(res,404,{error:"servicing_loan_not_found"});return send(res,200,row);
    }
    if(req.method==="POST"&&url.pathname.startsWith("/api/servicing-loans/")&&url.pathname.endsWith("/allocate-repayment")){
      if(!requireRole(a,["owner","maker","integration"]))return send(res,403,{error:"maker_or_integration_required"});
      const id=decodeURIComponent(url.pathname.slice("/api/servicing-loans/".length,-"/allocate-repayment".length));
      const loan=scoped(store.servicing_loans,s).find(x=>x.id===id);if(!loan)return send(res,404,{error:"servicing_loan_not_found"});
      const b=await body(req),payment=scoped(store.payments,s).find(x=>x.id===clean(b.payment_reference_id,180)||x.external_payment_ref===clean(b.payment_reference_id,200));
      if(!payment)return send(res,404,{error:"payment_reference_not_found"});
      if(payment.status!=="verified-reference"&&payment.status!=="verified")return send(res,422,{error:"verified_payment_reference_required"});
      if(scoped(store.repayment_allocations,s).some(x=>x.payment_reference_id===payment.id))return send(res,200,{idempotent_replay:true,item:scoped(store.repayment_allocations,s).find(x=>x.payment_reference_id===payment.id)});
      let remaining=payment.amount;
      for(const inst of loan.schedule){
        const outstanding=Math.max(0,Math.round((inst.total_due-inst.paid_amount)*100)/100);
        if(outstanding<=0)continue;
        const applied=Math.min(outstanding,remaining);
        inst.paid_amount=Math.round((inst.paid_amount+applied)*100)/100;
        remaining=Math.round((remaining-applied)*100)/100;
        inst.status=inst.paid_amount>=inst.total_due?"paid":"part-paid";
        if(remaining<=0)break;
      }
      const allocated=Math.round((payment.amount-remaining)*100)/100;
      loan.total_allocated=Math.round((loan.total_allocated+allocated)*100)/100;loan.updated_at=now();
      if(loan.total_allocated>=loan.total_due)loan.status="settled_software_record";
      const row={id:uid("alloc"),...s,servicing_loan_id:loan.id,payment_reference_id:payment.id,external_payment_ref:payment.external_payment_ref,amount_received:payment.amount,amount_allocated:allocated,unallocated_amount:remaining,currency:payment.currency,money_moved_by_finance_core:false,created_at:now()};
      store.repayment_allocations.push(row);audit(store,s,a,"repayment_reference.allocated","servicing_loan",loan.id,{allocation_id:row.id,amount_allocated:allocated});await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/arrears"){
      const asOf=isoDate(url.searchParams.get("as_of")||new Date().toISOString().slice(0,10));if(!asOf)return send(res,400,{error:"invalid as_of date"});
      const items=scoped(store.servicing_loans,s).map(loan=>{
        const overdue=loan.schedule.filter(x=>x.due_date<asOf&&x.paid_amount<x.total_due);
        const amount=Math.round(overdue.reduce((n,x)=>n+(x.total_due-x.paid_amount),0)*100)/100;
        return{servicing_loan_id:loan.id,customer_ref:loan.customer_ref,currency:loan.currency,overdue_instalments:overdue.length,arrears_amount:amount,oldest_due_date:overdue[0]?.due_date||null};
      }).filter(x=>x.arrears_amount>0);
      return send(res,200,{as_of:asOf,items,total_arrears:Math.round(items.reduce((n,x)=>n+x.arrears_amount,0)*100)/100});
    }
    if(req.method==="POST"&&url.pathname==="/api/collection-cases"){
      if(!requireRole(a,["owner","maker"]))return send(res,403,{error:"maker_required"});
      const b=await body(req),loan=scoped(store.servicing_loans,s).find(x=>x.id===clean(b.servicing_loan_id,180));
      if(!loan)return send(res,404,{error:"servicing_loan_not_found"});
      const row={id:uid("collect"),...s,servicing_loan_id:loan.id,customer_ref:loan.customer_ref,status:"open",reason:clean(b.reason||"arrears_followup",120),channel:clean(b.channel||"manual",40),automated_contact:false,created_by:a.id,created_at:now(),updated_at:now()};
      store.collection_cases.push(row);audit(store,s,a,"collection_case.opened","collection_case",row.id,{servicing_loan_id:loan.id,automated_contact:false});await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/collection-cases")return send(res,200,{items:scoped(store.collection_cases,s).slice(-500).reverse()});


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
      const allowed=new Set(["account.activate-record","loan-record.activate","payment-adapter.enable","product-config.publish","institution-config.publish"]);
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
      const loans=scoped(store.loan_applications,s),servicing=scoped(store.servicing_loans,s),accounts=scoped(store.accounts,s),payments=scoped(store.payments,s),approvals=scoped(store.approvals,s),products=scoped(store.product_configs,s),collections=scoped(store.collection_cases,s);
      return send(res,200,{scope:s,loan_applications:loans.length,servicing_loans:servicing.length,published_products:products.filter(x=>x.status==="published").length,accounts:accounts.length,payment_references:payments.length,collection_cases_open:collections.filter(x=>x.status==="open").length,pending_approvals:approvals.filter(x=>x.status==="pending").length,application_value:loans.reduce((n,x)=>n+x.amount,0),servicing_principal:servicing.reduce((n,x)=>n+x.principal,0),allocated_repayments:servicing.reduce((n,x)=>n+x.total_allocated,0),privacy:{tracking:false,profiling:false},regulated_actions:{money_movement:false,deposit_taking:false,final_credit_decisions:false}});
    }
    if(req.method==="GET"&&url.pathname==="/api/audit/integrity")return send(res,200,verifyAuditChain(store.audit));
    if(req.method==="GET"&&url.pathname==="/api/audit")return send(res,200,{items:scoped(store.audit,s).slice(-1000).reverse(),integrity:verifyAuditChain(store.audit)});
    return send(res,404,{error:"not_found"});
  }catch(e){return send(res,e.status||500,{error:e.status?e.message:"internal_error"})}
});
server.listen(PORT,HOST,()=>{console.log("IZAKHONO_FINANCE_CORE=READY");console.log("FINANCE_CORE_PORT="+PORT);console.log("ENCRYPTED_PERSISTENCE="+(KEY?"CONFIGURED":"NOT_CONFIGURED"));console.log("MAKER_CHECKER="+(MAKERS.length&&CHECKERS.length?"CONFIGURED":"NOT_CONFIGURED"))});
