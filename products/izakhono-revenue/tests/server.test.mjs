import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dir=await fs.mkdtemp(path.join(os.tmpdir(),"izakhono-revenue-"));
const port=18795;
const child=spawn(process.execPath,["server.mjs"],{cwd:new URL("..",import.meta.url),env:{...process.env,HOST:"127.0.0.1",PORT:String(port),REVENUE_DATA_FILE:path.join(dir,"data.json"),REVENUE_FLOW_TOKEN:"test-token",REVENUE_ALLOW_INSECURE_LOCAL:"false"},stdio:"ignore"});
const base="http://127.0.0.1:"+port;
const headers={"content-type":"application/json","authorization":"Bearer test-token","x-entity-id":"izakhono-africa","x-platform-id":"faisready"};
for(let i=0;i<50;i++){try{if((await fetch(base+"/health")).ok)break}catch{};await new Promise(r=>setTimeout(r,50))}
try{
  let r=await fetch(base+"/api/flow",{method:"POST",headers,body:JSON.stringify({action_id:"a1",run_id:"r1",action_type:"quote.prepare.requested",payload:{subject_ref:"lead-1",metadata:{value:399,currency:"ZAR"}}})});
  assert.equal(r.status,201);let j=await r.json();assert.equal(j.record.amount_minor,39900);assert.equal(j.record.status,"draft");
  r=await fetch(base+"/api/flow",{method:"POST",headers,body:JSON.stringify({action_id:"a1",run_id:"r1",action_type:"quote.prepare.requested",payload:{subject_ref:"lead-1"}})});
  assert.equal(r.status,200);j=await r.json();assert.equal(j.idempotent_replay,true);
  r=await fetch(base+"/api/flow",{method:"POST",headers,body:JSON.stringify({action_id:"a2",run_id:"r1",action_type:"invoice.issue.requested",payload:{subject_ref:"lead-1"}})});
  assert.equal(r.status,201);j=await r.json();assert.equal(j.record.amount_minor,39900);assert.equal(j.record.quote_id.startsWith("quote_"),true);
  r=await fetch(base+"/api/quotes",{headers});j=await r.json();assert.equal(j.items.length,1);
  console.log("IZAKHONO REVENUE server tests passed");
}finally{child.kill("SIGTERM");await fs.rm(dir,{recursive:true,force:true})}
