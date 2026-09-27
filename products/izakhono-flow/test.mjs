import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const dir=await fs.mkdtemp(path.join(os.tmpdir(),"izakhono-flow-"));
const port=18642;
const child=spawn(process.execPath,["server.mjs"],{
  cwd:new URL(".",import.meta.url),
  env:{...process.env,PORT:String(port),HOST:"127.0.0.1",FLOW_DATA_FILE:path.join(dir,"data.json"),FLOW_ADMIN_TOKEN:"admin-test",FLOW_INGEST_TOKEN:"ingest-test",FLOW_ALLOW_INSECURE_LOCAL:"false"},
  stdio:["ignore","pipe","pipe"]
});
const base="http://127.0.0.1:"+port;
const headers={"x-entity-id":"izakhono-africa","x-platform-id":"faisready"};

async function waitForHealth(){
  for(let i=0;i<50;i++){
    try{const r=await fetch(base+"/health");if(r.ok)return}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error("server did not start");
}

try{
  await waitForHealth();
  let r=await fetch(base+"/api/events",{method:"POST",headers:{...headers,authorization:"Bearer ingest-test","content-type":"application/json"},body:JSON.stringify({event_type:"lead.created",subject_ref:"lead-1",source_service:"faisready",metadata:{email:"person@example.com",secret:"strip-this"}})});
  assert.equal(r.status,201);
  let data=await r.json();
  assert.equal(data.run.stage,"lead");
  assert.equal(data.actions[0].target,"izakhono-crm");

  r=await fetch(base+"/api/events",{method:"POST",headers:{...headers,authorization:"Bearer ingest-test","content-type":"application/json"},body:JSON.stringify({event_type:"payment.confirmed",subject_ref:"lead-1",source_service:"faisready",verification:{status:"verified"},references:{payment_reference:"p1"}})});
  assert.equal(r.status,422);

  r=await fetch(base+"/api/events",{method:"POST",headers:{...headers,authorization:"Bearer ingest-test","content-type":"application/json"},body:JSON.stringify({event_type:"payment.confirmed",subject_ref:"lead-1",source_service:"izakhono-pay",verification:{status:"verified"},references:{payment_intent_id:"pi_1"}})});
  assert.equal(r.status,201);
  data=await r.json();
  assert.equal(data.run.stage,"paid");

  r=await fetch(base+"/api/summary",{headers:{...headers,authorization:"Bearer admin-test"}});
  data=await r.json();
  assert.equal(data.active_runs,1);
  assert.equal(data.by_stage.paid,1);

  r=await fetch(base+"/api/events",{headers:{...headers,authorization:"Bearer admin-test"}});
  data=await r.json();
  const lead=data.items.find(x=>x.event_type==="lead.created");
  assert.equal(lead.metadata.secret,undefined);
  console.log("IZAKHONO FLOW tests passed");
}finally{
  child.kill("SIGTERM");
  await fs.rm(dir,{recursive:true,force:true});
}
