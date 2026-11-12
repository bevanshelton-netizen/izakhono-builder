import assert from "node:assert/strict";import{jarvisWorkforceRoute}from"./workforce";
function req(method:string,path:string,body?:unknown){return new Request("https://builder.example"+path,{method,headers:body===undefined?{}:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});}
async function main(){let reads=0,writes=0;const env={DB:{prepare(sql:string){return{bind(..._v:unknown[]){return{async all(){reads++;return{results:[]}},async first(){reads++;return sql.includes("owner_verification")?{id:"stp1",run_id:"orc1",assigned_agent:"reporting",status:"completed",attempts:1,max_attempts:3,evidence_json:'{"evidence":"Internal validation report saved"}',owner_verification:"pending"}:sql.includes("SELECT s.id,s.run_id")?{id:"stp1",run_id:"orc1",attempts:0,max_attempts:3}:sql.includes("COUNT(*)")?{n:0}:{id:"stp1",run_id:"orc1",assigned_agent:"reporting",status:"in_progress",attempts:1,max_attempts:3}},async run(){writes++;return{meta:{changes:1}}}}}}}}};
assert.equal((await jarvisWorkforceRoute(req("GET","/api/jarvis/workforce"),env,async()=>false))?.status,401);assert.equal(reads,0);
assert.equal((await jarvisWorkforceRoute(req("POST","/api/jarvis/workforce/claim",{agent_id:"intruder"}),env,async()=>true))?.status,400);
assert.equal((await jarvisWorkforceRoute(req("POST","/api/jarvis/workforce/claim",{agent_id:"reporting"}),env,async()=>true))?.status,200);
assert.equal((await jarvisWorkforceRoute(req("POST","/api/jarvis/workforce/steps/stp1/complete",{agent_id:"reporting",evidence:"x"}),env,async()=>true))?.status,400);
assert.equal((await jarvisWorkforceRoute(req("POST","/api/jarvis/workforce/steps/stp1/complete",{agent_id:"reporting",evidence:"Internal validation report saved"}),env,async()=>true))?.status,200);
assert.equal((await jarvisWorkforceRoute(req("POST","/api/jarvis/workforce/steps/stp1/review",{decision:"verify"}),env,async()=>true))?.status,200);
assert.equal((await jarvisWorkforceRoute(req("POST","/api/jarvis/workforce/steps/stp1/fail",{agent_id:"coordinator",error:"blocked"}),env,async()=>true))?.status,409);
assert.ok(writes>0);console.log("J.A.R.V.I.S. workforce queue and owner review tests passed");}
main().catch(e=>{console.error(e);process.exitCode=1});
