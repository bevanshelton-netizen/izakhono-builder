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
  assert.equal(health.version,"0.2.0");
  assert.equal(health.boundaries.moneyMovement,false);
  assert.equal(health.security.makerChecker,true);
  assert.equal(health.security.auditHashChain,true);

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
    public_live:false
  },null,2));
} finally {
  child.kill("SIGTERM");
  await new Promise(r=>setTimeout(r,100));
  await fs.rm(temp,{recursive:true,force:true});
}
