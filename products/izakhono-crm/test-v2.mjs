import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const port=19080+Math.floor(Math.random()*500);
const dir=await fs.mkdtemp(path.join(os.tmpdir(),"izakhono-crm-v2-"));
const dataFile=path.join(dir,"crm.json"),staffFile=path.join(dir,"staff.json");
const tokenHash=v=>crypto.createHash("sha256").update(v).digest("hex");
await fs.writeFile(staffFile,JSON.stringify({staff:[
  {id:"mgr",name:"Manager",role:"manager",token_sha256:tokenHash("manager-secret"),scopes:[{entity_id:"izakhono-africa",platform_id:"faisready"}]},
  {id:"view",name:"Viewer",role:"viewer",token_sha256:tokenHash("viewer-secret"),scopes:[{entity_id:"izakhono-africa",platform_id:"faisready"}]}
]}));
const child=spawn(process.execPath,["server-v2.mjs"],{cwd:new URL(".",import.meta.url),env:{...process.env,HOST:"127.0.0.1",PORT:String(port),CRM_DATA_FILE:dataFile,CRM_STAFF_FILE:staffFile,CRM_INGEST_TOKEN:"ingest-secret",CRM_ALLOW_INSECURE_LOCAL:"false"},stdio:["ignore","pipe","pipe"]});
async function wait(){for(let i=0;i<60;i++){try{const r=await fetch(`http://127.0.0.1:${port}/health`);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,40));}throw new Error("health timeout");}
const base={"content-type":"application/json","x-entity-id":"izakhono-africa","x-platform-id":"faisready"};
const hdr=t=>({...base,authorization:`Bearer ${t}`});

test("health and scoped roles",async()=>{
  await wait();
  const me=await fetch(`http://127.0.0.1:${port}/api/me`,{headers:hdr("manager-secret")}).then(r=>r.json()); assert.equal(me.role,"manager");
  const denied=await fetch(`http://127.0.0.1:${port}/api/summary`,{headers:{...hdr("manager-secret"),"x-platform-id":"kora"}}); assert.equal(denied.status,403);
  const viewerWrite=await fetch(`http://127.0.0.1:${port}/api/contacts`,{method:"POST",headers:hdr("viewer-secret"),body:JSON.stringify({name:"Nope"})}); assert.equal(viewerWrite.status,403);
});

test("pipeline, automations, intake and outbox",async()=>{
  await wait();
  const p=await fetch(`http://127.0.0.1:${port}/api/pipeline`,{headers:hdr("manager-secret")}).then(r=>r.json()); assert.ok(p.stages.length>=2);
  const rule=await fetch(`http://127.0.0.1:${port}/api/automations`,{method:"POST",headers:hdr("manager-secret"),body:JSON.stringify({name:"Won follow-up",event:"stage_changed",conditions:{to_stage:"Won"},actions:[{type:"create_activity",activity_type:"handover",note:"Start customer handover"}]})}); assert.equal(rule.status,201);
  const intake=await fetch(`http://127.0.0.1:${port}/api/intake`,{method:"POST",headers:hdr("ingest-secret"),body:JSON.stringify({contact:{name:"Lead",email:"lead@example.test"},create_deal:true,deal:{title:"RE5",value:299,stage:p.stages[0].label,external_ref:"test:1"}})}); assert.equal(intake.status,201); const ib=await intake.json();
  const wonStage=p.stages.find(s=>/won/i.test(s.label))?.label||p.stages.at(-2).label;
  const patch=await fetch(`http://127.0.0.1:${port}/api/deals/${encodeURIComponent(ib.deal.id)}`,{method:"PATCH",headers:hdr("manager-secret"),body:JSON.stringify({stage:wonStage})}); assert.equal(patch.status,200);
  const acts=await fetch(`http://127.0.0.1:${port}/api/activities`,{headers:hdr("manager-secret")}).then(r=>r.json()); assert.ok(acts.items.some(a=>a.type==="handover"));
  const out=await fetch(`http://127.0.0.1:${port}/api/integrations/outbox`,{headers:hdr("manager-secret")}).then(r=>r.json()); assert.ok(out.items.some(e=>e.event_type==="crm.intake.received"));
});

test("pipeline update prevents orphaning live deal stages",async()=>{
  await wait();
  const r=await fetch(`http://127.0.0.1:${port}/api/pipeline`,{method:"PUT",headers:hdr("manager-secret"),body:JSON.stringify({name:"Bad",stages:[{label:"A"},{label:"B"}]})}); assert.equal(r.status,409);
});

test.after(async()=>{child.kill("SIGTERM");await fs.rm(dir,{recursive:true,force:true});});
