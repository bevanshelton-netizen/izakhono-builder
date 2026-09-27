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
const KEY=loadKey(process.env.FINANCE_DATA_KEY_B64||"");
const EMPTY={loan_applications:[],accounts:[],payments:[],audit:[]};
let writes=Promise.resolve();

function loadKey(raw){
  if(!raw)return null;
  try{const b=Buffer.from(raw,"base64");return b.length===32?b:null}catch{return null}
}
function now(){return new Date().toISOString()}
function uid(prefix){return prefix+"_"+crypto.randomUUID()}
function clean(v,max=300){return String(v??"").trim().slice(0,max)}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null}
function send(res,status,body){
  const data=JSON.stringify(body);
  res.writeHead(status,{
    "content-type":"application/json; charset=utf-8",
    "content-length":Buffer.byteLength(data),
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer"
  });
  res.end(data);
}
function bearer(req){const v=String(req.headers.authorization||"");return v.startsWith("Bearer ")?v.slice(7):""}
function same(a,b){if(!a||!b)return false;const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function actor(req,kind){
  const token=bearer(req);
  if(ADMIN_TOKEN&&same(token,ADMIN_TOKEN))return{id:"owner",role:"owner"};
  if(kind==="ingest"&&INGEST_TOKEN&&same(token,INGEST_TOKEN))return{id:"integration",role:"integration"};
  if(!ADMIN_TOKEN&&!INGEST_TOKEN&&ALLOW_LOCAL)return{id:"local-dev",role:"owner"};
  return null;
}
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
  const e=JSON.parse(buf.toString("utf8")),iv=Buffer.from(e.iv,"base64"),tag=Buffer.from(e.tag,"base64"),ct=Buffer.from(e.ct,"base64");
  const d=crypto.createDecipheriv("aes-256-gcm",KEY,iv);d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct),d.final()]).toString("utf8"));
}
async function readStore(){
  try{const x=decrypt(await fs.readFile(DATA_FILE));return Object.fromEntries(Object.keys(EMPTY).map(k=>[k,Array.isArray(x[k])?x[k]:[]]))}
  catch(e){if(e.code==="ENOENT")return structuredClone(EMPTY);throw e}
}
async function writeStore(store){
  writes=writes.then(async()=>{await fs.mkdir(path.dirname(DATA_FILE),{recursive:true});const tmp=DATA_FILE+"."+process.pid+".tmp";await fs.writeFile(tmp,encrypt(store),{mode:0o600});await fs.rename(tmp,DATA_FILE)});
  return writes;
}
function audit(store,s,a,action,target_type,target_id,detail={}){
  store.audit.push({id:uid("audit"),...s,actor_id:a.id,actor_role:a.role,action,target_type,target_id,detail,created_at:now()});
  if(store.audit.length>20000)store.audit.splice(0,store.audit.length-20000);
}
function capabilities(){
  return{
    service:"izakhono-finance-core",version:"0.1.0",engineIndependent:true,ownedFirst:true,
    capabilities:["loan origination","loan servicing","savings/member account administration","payments ledger references","collections workflow","reporting","maker-checker","audit"],
    integrations:["FORTRESS","SUPER ACCOUNTANT","IZAKHONO CRM","FLOWIQ","IZAKHONO PAY","IZAKHONO SUPER AI advisory"],
    boundaries:{softwareVendorOnly:true,depositTaking:false,creditProvider:false,automatedFinalCreditDecision:false,moneyMovement:false},
    privacy:{tracking:false,profiling:false,advertisingIdentifiers:false}
  };
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://"+(req.headers.host||"localhost"));
    if(req.method==="GET"&&url.pathname==="/health")return send(res,200,{ok:true,...capabilities(),encryptedPersistenceConfigured:Boolean(KEY)});
    if(req.method==="GET"&&url.pathname==="/api/capabilities")return send(res,200,capabilities());
    if(req.method==="GET"&&(url.pathname==="/"||url.pathname==="/index.html")){
      const html=await fs.readFile(path.join(here,"public","index.html"),"utf8");
      res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});return res.end(html);
    }
    if(!url.pathname.startsWith("/api/"))return send(res,404,{error:"not_found"});
    const s=scope(req,url);if(!s)return send(res,400,{error:"X-Institution-ID and X-Entity-ID are required"});
    const kind=req.method==="POST"?"ingest":"read";const a=actor(req,kind);if(!a)return send(res,401,{error:"unauthorized"});
    if(!KEY)return send(res,503,{error:"encrypted_persistence_not_configured",required:"FINANCE_DATA_KEY_B64 (32-byte key, base64)"});
    const store=await readStore();

    if(req.method==="POST"&&url.pathname==="/api/loan-applications"){
      const b=await body(req),amount=money(b.amount),term=Number(b.term_months);
      if(!clean(b.customer_ref,160)||!clean(b.product_ref,160)||amount===null||!Number.isInteger(term)||term<1||term>600)return send(res,400,{error:"customer_ref, product_ref, non-negative amount and term_months 1..600 required"});
      const row={id:uid("loan"),...s,customer_ref:clean(b.customer_ref,160),product_ref:clean(b.product_ref,160),amount,currency:clean(b.currency||"ZAR",8).toUpperCase(),term_months:term,status:"received",final_credit_decision:null,created_at:now(),updated_at:now()};
      store.loan_applications.push(row);audit(store,s,a,"loan_application.received","loan_application",row.id,{amount:row.amount,currency:row.currency});await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/loan-applications")return send(res,200,{items:scoped(store.loan_applications,s).slice(-500).reverse()});

    if(req.method==="POST"&&url.pathname==="/api/accounts"){
      const b=await body(req);if(!clean(b.customer_ref,160)||!clean(b.product_ref,160))return send(res,400,{error:"customer_ref and product_ref required"});
      const row={id:uid("acct"),...s,customer_ref:clean(b.customer_ref,160),product_ref:clean(b.product_ref,160),account_type:clean(b.account_type||"member",40),currency:clean(b.currency||"ZAR",8).toUpperCase(),status:"pending_authorisation",balance:0,created_at:now(),updated_at:now()};
      store.accounts.push(row);audit(store,s,a,"account.requested","account",row.id);await writeStore(store);return send(res,201,row);
    }
    if(req.method==="GET"&&url.pathname==="/api/accounts")return send(res,200,{items:scoped(store.accounts,s).slice(-500).reverse()});

    if(req.method==="POST"&&url.pathname==="/api/payments/reference"){
      const b=await body(req),amount=money(b.amount);if(!clean(b.customer_ref,160)||!clean(b.external_payment_ref,200)||amount===null)return send(res,400,{error:"customer_ref, external_payment_ref and non-negative amount required"});
      const row={id:uid("payref"),...s,customer_ref:clean(b.customer_ref,160),external_payment_ref:clean(b.external_payment_ref,200),amount,currency:clean(b.currency||"ZAR",8).toUpperCase(),status:clean(b.status||"unverified",40),money_moved_by_finance_core:false,created_at:now()};
      store.payments.push(row);audit(store,s,a,"payment.reference_recorded","payment_reference",row.id,{amount:row.amount,currency:row.currency,status:row.status});await writeStore(store);return send(res,201,row);
    }

    if(req.method==="GET"&&url.pathname==="/api/summary"){
      const loans=scoped(store.loan_applications,s),accounts=scoped(store.accounts,s),payments=scoped(store.payments,s);
      return send(res,200,{scope:s,loan_applications:loans.length,accounts:accounts.length,payment_references:payments.length,loan_value:loans.reduce((n,x)=>n+x.amount,0),privacy:{tracking:false,profiling:false},regulated_actions:{money_movement:false,deposit_taking:false,final_credit_decisions:false}});
    }
    if(req.method==="GET"&&url.pathname==="/api/audit")return send(res,200,{items:scoped(store.audit,s).slice(-1000).reverse()});
    return send(res,404,{error:"not_found"});
  }catch(e){return send(res,e.status||500,{error:e.status?e.message:"internal_error"})}
});
server.listen(PORT,HOST,()=>{console.log("IZAKHONO_FINANCE_CORE=READY");console.log("FINANCE_CORE_PORT="+PORT);console.log("ENCRYPTED_PERSISTENCE="+(KEY?"CONFIGURED":"NOT_CONFIGURED"))});
