import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const temp=await fs.mkdtemp(path.join(os.tmpdir(),"izakhono-finance-core-"));
const dataFile=path.join(temp,"finance-core.enc");
const restoredFile=path.join(temp,"restored.enc");
const backupDir=path.join(temp,"backups");
const port=18970+Math.floor(Math.random()*200);
const base="http://127.0.0.1:"+port;
const key=crypto.randomBytes(32).toString("base64");
const makerToken="smoke-maker-token";
const checkerToken="smoke-checker-token";
const adminToken="smoke-admin-token";
const ingestToken="smoke-ingest-token";
const env={
  ...process.env,
  HOST:"127.0.0.1",
  PORT:String(port),
  FINANCE_DATA_FILE:dataFile,
  FINANCE_DATA_KEY_B64:key,
  FINANCE_ADMIN_TOKEN:adminToken,
  FINANCE_INGEST_TOKEN:ingestToken,
  FINANCE_MAKER_TOKENS_JSON:JSON.stringify({[makerToken]:"maker-smoke"}),
  FINANCE_CHECKER_TOKENS_JSON:JSON.stringify({[checkerToken]:"checker-smoke"}),
  FINANCE_ALLOW_INSECURE_LOCAL:"false"
};

const child=spawn(process.execPath,["server.mjs"],{cwd:here,env,stdio:["ignore","pipe","pipe"]});
let stderr="";
child.stderr.on("data",d=>stderr+=d.toString());

async function waitReady(){
  for(let i=0;i<80;i++){
    try{const r=await fetch(base+"/health");if(r.ok)return await r.json()}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error("server did not become ready: "+stderr);
}
async function req(method,url,token,body){
  const r=await fetch(base+url,{
    method,
    headers:{
      "content-type":"application/json",
      "authorization":"Bearer "+token,
      "x-institution-id":"institution-smoke",
      "x-entity-id":"entity-smoke"
    },
    body:body===undefined?undefined:JSON.stringify(body)
  });
  let data=null;try{data=await r.json()}catch{}
  return{status:r.status,data};
}
async function runNode(script,args,extraEnv={}){
  return await new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,[script,...args],{cwd:here,env:{...env,...extraEnv},stdio:["ignore","pipe","pipe"]});
    let out="",err="";p.stdout.on("data",d=>out+=d);p.stderr.on("data",d=>err+=d);
    p.on("error",reject);p.on("close",code=>code===0?resolve({out,err}):reject(new Error(script+" failed ("+code+"): "+err+"\n"+out)));
  });
}

try{
  const health=await waitReady();
  assert.equal(health.ok,true);
  assert.equal(health.version,"0.3.0");
  assert.equal(health.boundaries.moneyMovement,false);
  assert.equal(health.security.makerChecker,true);
  assert.equal(health.security.auditHashChain,true);

  const institution=await req("POST","/api/institution-configs",makerToken,{display_name:"Smoke Finance Co",short_name:"Smoke",country_code:"ZA",currency:"ZAR",locale:"en-ZA",brand:{primary:"#071b33"}});
  assert.equal(institution.status,201);
  const institutionApproval=await req("POST","/api/approvals/request",makerToken,{action_type:"institution-config.publish",target_type:"institution_config",target_id:institution.data.id});
  assert.equal(institutionApproval.status,201);
  const institutionApproved=await req("POST","/api/approvals/"+institutionApproval.data.id+"/approve",checkerToken,{note:"publish institution config"});
  assert.equal(institutionApproved.status,200);
  const institutionPublished=await req("POST","/api/institution-configs/"+institution.data.id+"/publish",checkerToken,{approval_id:institutionApproval.data.id});
  assert.equal(institutionPublished.status,200);
  assert.equal(institutionPublished.data.status,"published");

  const product=await req("POST","/api/product-configs",makerToken,{name:"Smoke Personal Loan",product_code:"smoke-personal",currency:"ZAR",annual_rate:12,interest_method:"declining",default_term_months:6,min_amount:100,max_amount:10000});
  assert.equal(product.status,201);
  assert.equal(product.data.decisioning,false);
  const productApproval=await req("POST","/api/approvals/request",makerToken,{action_type:"product-config.publish",target_type:"product_config",target_id:product.data.id});
  assert.equal(productApproval.status,201);
  const productApproved=await req("POST","/api/approvals/"+productApproval.data.id+"/approve",checkerToken,{note:"publish product"});
  assert.equal(productApproved.status,200);
  const productPublished=await req("POST","/api/product-configs/"+product.data.id+"/publish",checkerToken,{approval_id:productApproval.data.id});
  assert.equal(productPublished.status,200);
  assert.equal(productPublished.data.status,"published");

  const application=await req("POST","/api/loan-applications",makerToken,{customer_ref:"customer-smoke-001",product_ref:product.data.id,amount:1200,currency:"ZAR",term_months:6});
  assert.equal(application.status,201);
  assert.equal(application.data.final_credit_decision,null);
  const loanApproval=await req("POST","/api/approvals/request",makerToken,{action_type:"loan-record.activate",target_type:"loan_application",target_id:application.data.id});
  assert.equal(loanApproval.status,201);
  const loanApproved=await req("POST","/api/approvals/"+loanApproval.data.id+"/approve",checkerToken,{note:"activate servicing record"});
  assert.equal(loanApproved.status,200);
  const servicing=await req("POST","/api/servicing-loans",checkerToken,{application_id:application.data.id,approval_id:loanApproval.data.id,start_date:"2026-01-15"});
  assert.equal(servicing.status,201);
  assert.equal(servicing.data.principal_disbursed_by_finance_core,false);
  assert.equal(servicing.data.schedule.length,6);
  assert.ok(servicing.data.total_due>=1200);

  const account=await req("POST","/api/accounts",makerToken,{customer_ref:"customer-smoke-001",product_ref:"member-basic",currency:"ZAR"});
  assert.equal(account.status,201);
  assert.equal(account.data.status,"pending_authorisation");
  assert.equal(account.data.deposit_taking_enabled,false);

  const approval=await req("POST","/api/approvals/request",makerToken,{action_type:"account.activate-record",target_type:"account",target_id:account.data.id,detail:{reason:"runtime smoke"}});
  assert.equal(approval.status,201);
  assert.equal(approval.data.requested_by,"maker-smoke");

  const makerSelfApprove=await req("POST","/api/approvals/"+approval.data.id+"/approve",makerToken,{note:"must fail"});
  assert.equal(makerSelfApprove.status,403);

  const approved=await req("POST","/api/approvals/"+approval.data.id+"/approve",checkerToken,{note:"separate checker"});
  assert.equal(approved.status,200);
  assert.equal(approved.data.status,"approved");
  assert.equal(approved.data.approved_by,"checker-smoke");

  const activated=await req("POST","/api/accounts/"+account.data.id+"/activate-record",checkerToken,{approval_id:approval.data.id});
  assert.equal(activated.status,200);
  assert.equal(activated.data.status,"approved_software_record");
  assert.equal(activated.data.deposit_taking_enabled,false);

  const paymentBody={customer_ref:"customer-smoke-001",external_payment_ref:"pay-smoke-001",amount:123.45,currency:"ZAR",status:"verified-reference"};
  const payment1=await req("POST","/api/payments/reference",makerToken,paymentBody);
  assert.equal(payment1.status,201);
  assert.equal(payment1.data.money_moved_by_finance_core,false);
  const payment2=await req("POST","/api/payments/reference",makerToken,paymentBody);
  assert.equal(payment2.status,200);
  assert.equal(payment2.data.idempotent_replay,true);
  assert.equal(payment2.data.id,payment1.data.id);

  const allocation=await req("POST","/api/servicing-loans/"+servicing.data.id+"/allocate-repayment",makerToken,{payment_reference_id:payment1.data.id});
  assert.equal(allocation.status,201);
  assert.equal(allocation.data.money_moved_by_finance_core,false);
  assert.ok(allocation.data.amount_allocated>0);

  const allocationReplay=await req("POST","/api/servicing-loans/"+servicing.data.id+"/allocate-repayment",makerToken,{payment_reference_id:payment1.data.id});
  assert.equal(allocationReplay.status,200);
  assert.equal(allocationReplay.data.idempotent_replay,true);

  const arrears=await req("GET","/api/arrears?as_of=2026-12-31",checkerToken);
  assert.equal(arrears.status,200);
  assert.ok(arrears.data.items.some(x=>x.servicing_loan_id===servicing.data.id));

  const collection=await req("POST","/api/collection-cases",makerToken,{servicing_loan_id:servicing.data.id,reason:"arrears_followup",channel:"manual"});
  assert.equal(collection.status,201);
  assert.equal(collection.data.automated_contact,false);

  const integrity=await req("GET","/api/audit/integrity",checkerToken);
  assert.equal(integrity.status,200);
  assert.equal(integrity.data.valid,true);
  assert.ok(integrity.data.count>=5);
  assert.match(integrity.data.head_hash,/^[a-f0-9]{64}$/);

  const raw=await fs.readFile(dataFile,"utf8");
  assert.equal(raw.includes("customer-smoke-001"),false);
  assert.equal(raw.includes("pay-smoke-001"),false);
  const envelope=JSON.parse(raw);
  assert.equal(envelope.alg,"A256GCM");

  const backup=await runNode("ops/backup.mjs",[backupDir],{FINANCE_DATA_FILE:dataFile});
  const backupResult=JSON.parse(backup.out);
  const manifest=JSON.parse(await fs.readFile(backupResult.manifest,"utf8"));
  assert.equal(manifest.schema,"izakhono.finance-core.backup.v1");
  assert.match(manifest.sha256,/^[a-f0-9]{64}$/);

  await runNode("ops/restore.mjs",[backupResult.manifest],{
    FINANCE_DATA_FILE:restoredFile,
    FINANCE_RESTORE_APPROVED:"YES"
  });
  const originalHash=crypto.createHash("sha256").update(await fs.readFile(dataFile)).digest("hex");
  const restoredHash=crypto.createHash("sha256").update(await fs.readFile(restoredFile)).digest("hex");
  assert.equal(restoredHash,originalHash);

  console.log(JSON.stringify({
    ok:true,
    product:"IZAKHONO FINANCE CORE",
    runtime_smoke:true,
    maker_checker:true,
    audit_integrity:true,
    payment_idempotency:true,
    encrypted_persistence:true,
    backup_restore:true,
    institution_config:true,
    product_config:true,
    repayment_schedule:true,
    servicing_record:true,
    repayment_allocation:true,
    arrears_view:true,
    collections_case:true,
    public_live:false
  },null,2));
} finally {
  child.kill("SIGTERM");
  await new Promise(r=>setTimeout(r,100));
  await fs.rm(temp,{recursive:true,force:true});
}
