import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const dir=await fs.mkdtemp(path.join(os.tmpdir(),"izakhono-flow-"));
const port=18642;
const adapterPort=18643;
const received=[];
const adapter=createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
  received.push({url:req.url,auth:req.headers.authorization,entity:req.headers["x-entity-id"],platform:req.headers["x-platform-id"],aiKey:req.headers["x-izakhono-ai-key"],workflowKey:req.headers["x-izakhono-ai-workflow-key"],body});
  const out=JSON.stringify({ok:true});
  res.writeHead(200,{"content-type":"application/json","content-length":Buffer.byteLength(out)});res.end(out);
});
await new Promise(resolve=>adapter.listen(adapterPort,"127.0.0.1",resolve));
const child=spawn(process.execPath,["server.mjs"],{
  cwd:new URL(".",import.meta.url),
  env:{...process.env,PORT:String(port),HOST:"127.0.0.1",FLOW_DATA_FILE:path.join(dir,"data.json"),FLOW_ADMIN_TOKEN:"admin-test",FLOW_INGEST_TOKEN:"ingest-test",FLOW_ALLOW_INSECURE_LOCAL:"false",FLOW_ADAPTERS_JSON:JSON.stringify({
    "izakhono-crm":{url:`http://127.0.0.1:${adapterPort}/flow`,token:"adapter-secret"},
    "izakhono-super-ai":{kind:"super-ai-workflow",url:`http://127.0.0.1:${adapterPort}/api/v1/generate`,internal_key:"gateway-secret",workflow_key:"workflow-secret",product:"izakhono-flow",capability:"reasoning"}
  })},
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
  assert.equal(data.actions[0].status,"completed");
  assert.equal(data.deliveries[0].status,"completed");
  assert.equal(received.length,1);
  assert.equal(received[0].auth,"Bearer adapter-secret");
  assert.equal(received[0].entity,"izakhono-africa");
  assert.equal(received[0].platform,"faisready");

  r=await fetch(base+"/api/events",{method:"POST",headers:{...headers,authorization:"Bearer ingest-test","content-type":"application/json"},body:JSON.stringify({event_type:"payment.confirmed",subject_ref:"lead-1",source_service:"faisready",verification:{status:"verified"},references:{payment_reference:"p1"}})});
  assert.equal(r.status,422);

  r=await fetch(base+"/api/events",{method:"POST",headers:{...headers,authorization:"Bearer ingest-test","content-type":"application/json"},body:JSON.stringify({event_type:"payment.confirmed",subject_ref:"lead-1",source_service:"izakhono-pay",verification:{status:"verified"},references:{payment_intent_id:"pi_1"}})});
  assert.equal(r.status,201);
  data=await r.json();
  assert.equal(data.run.stage,"paid");

  r=await fetch(base+"/api/events",{method:"POST",headers:{...headers,authorization:"Bearer ingest-test","content-type":"application/json"},body:JSON.stringify({event_type:"ai.suggestion.requested",subject_ref:"lead-1",source_service:"izakhono-flow",metadata:{next_action_question:"What reversible follow-up is appropriate?",contact:{name:"Example Person",email:"example.person@example.test",phone:"+27110000000"},customer_reference:"sensitive-example"}})});
  assert.equal(r.status,201);
  data=await r.json();
  const aiAction=data.actions.find(a=>a.target==="izakhono-super-ai");
  assert.equal(aiAction.status,"completed");
  const aiReq=received.find(x=>x.aiKey==="gateway-secret");
  assert.ok(aiReq);
  assert.equal(aiReq.workflowKey,"workflow-secret");
  assert.equal(aiReq.body.entity_id,"izakhono-africa");
  assert.equal(aiReq.body.product,"izakhono-flow");
  assert.equal(aiReq.body.access_mode,"workflow");
  assert.equal(aiReq.body.capability,"reasoning");
  assert.equal(aiReq.body.route,"owned");
  assert.equal(aiReq.body.data_classification,"internal");
  assert.match(aiReq.body.messages[0].content,/Do not move money/);
  assert.match(aiReq.body.messages[0].content,/regulated decision/);
  assert.doesNotMatch(aiReq.body.subject,/lead-1/);
  assert.doesNotMatch(aiReq.body.messages[1].content,/Example Person/);
  assert.doesNotMatch(aiReq.body.messages[1].content,/example.person@example.test/);

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
  await new Promise(resolve=>adapter.close(resolve));
  await fs.rm(dir,{recursive:true,force:true});
}
