import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {spawn} from "node:child_process";
import {promises as fs} from "node:fs";
import os from "node:os";
import path from "node:path";

const crmPort=19100+Math.floor(Math.random()*300);
const gatewayPort=19500+Math.floor(Math.random()*300);
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),"izakhono-fabric-"));
let seen=null;
const crm=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  seen={headers:req.headers,body:JSON.parse(Buffer.concat(chunks).toString("utf8"))};
  res.writeHead(201,{"content-type":"application/json"});res.end(JSON.stringify({contact:{id:"c1"},deal:{id:"d1"}}));
});
await new Promise(resolve=>crm.listen(crmPort,"127.0.0.1",resolve));
const child=spawn(process.execPath,["server.mjs"],{
  cwd:new URL(".",import.meta.url),
  env:{...process.env,HOST:"127.0.0.1",PORT:String(gatewayPort),IZAKHONO_CRM_URL:`http://127.0.0.1:${crmPort}`,IZAKHONO_FABRIC_PUBLIC_INTAKE:"true",IZAKHONO_FABRIC_ALLOWED_ORIGINS:"https://faisready.example",IZAKHONO_FABRIC_INTERNAL_TOKEN:"internal-test",FABRIC_OUTBOX_FILE:path.join(tmp,"outbox.json")},
  stdio:["ignore","pipe","pipe"]
});
async function wait(){for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${gatewayPort}/health`)).ok)return}catch{}await new Promise(r=>setTimeout(r,50))}throw new Error("gateway not healthy")}

test("public FAISReady lead maps to scoped CRM intake",async()=>{
  await wait();
  const r=await fetch(`http://127.0.0.1:${gatewayPort}/api/fabric/intake`,{
    method:"POST",
    headers:{"content-type":"application/json","origin":"https://faisready.example"},
    body:JSON.stringify({platform_id:"faisready",event_type:"lead.created",subject_ref:"lead-1",contact:{name:"A Learner",email:"a@example.test"},opportunity:{title:"RE5 Complete",value:299,currency:"ZAR"}})
  });
  assert.equal(r.status,201);
  assert.equal(seen.headers["x-entity-id"],"izakhono-africa");
  assert.equal(seen.headers["x-platform-id"],"faisready");
  assert.equal(seen.body.deal.stage,"Lead");
  assert.equal(seen.body.deal.external_ref,"faisready:lead-1");
});

test("public payment confirmation is rejected",async()=>{
  const r=await fetch(`http://127.0.0.1:${gatewayPort}/api/fabric/intake`,{
    method:"POST",
    headers:{"content-type":"application/json","origin":"https://faisready.example"},
    body:JSON.stringify({platform_id:"faisready",event_type:"payment.confirmed",subject_ref:"x",contact:{email:"a@example.test"}})
  });
  assert.equal(r.status,403);
});

test("internal Edu-Build event does not require child data",async()=>{
  const r=await fetch(`http://127.0.0.1:${gatewayPort}/api/fabric/event`,{
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer internal-test"},
    body:JSON.stringify({platform_id:"edu-build",event_type:"lead.created",subject_ref:"enq-9",contact:{name:"Guardian Name",email:"g@example.test",phone:"0710000000"},note:"Admissions enquiry"})
  });
  assert.equal(r.status,201);
  assert.equal(seen.headers["x-entity-id"],"edu-build-shelton");
  assert.equal(seen.body.deal.stage,"Enquiry");
  assert.equal(Object.hasOwn(seen.body.contact,"child_first_name"),false);
});

test.after(async()=>{child.kill("SIGTERM");await new Promise(resolve=>crm.close(resolve));await fs.rm(tmp,{recursive:true,force:true})});
