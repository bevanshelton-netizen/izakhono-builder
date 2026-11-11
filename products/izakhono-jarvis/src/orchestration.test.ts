import assert from "node:assert/strict";
import {jarvisOrchestrationRoute} from "./orchestration";
function req(method:string,path="/api/jarvis/orchestrations",body?:unknown){return new Request("https://builder.example"+path,{method,headers:body===undefined?{}:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});}
async function main(){
 let reads=0,writes=0,sql:string[]=[];
 const env={DB:{prepare(s:string){sql.push(s);return{bind(..._v:unknown[]){return{
 async all(){reads++;return{results:[]}},async first(){reads++;return{id:"orc_1"}},async run(){writes++;return{}}
 };}};}}};
 const denied=await jarvisOrchestrationRoute(req("GET"),env,async()=>false);assert.equal(denied?.status,401);assert.equal(reads,0);
 const invalid=await jarvisOrchestrationRoute(req("POST","/api/jarvis/orchestrations",{instruction:"Do this",objective:"Outcome",steps:[]}),env,async()=>true);assert.equal(invalid?.status,400);assert.equal(writes,0);
 const created=await jarvisOrchestrationRoute(req("POST","/api/jarvis/orchestrations",{instruction:"Prepare a board briefing",objective:"Deliver an evidence-based board briefing",agent_id:"reporting",risk_level:"high",steps:["Collect verified inputs","Draft briefing","Submit for owner review"]}),env,async()=>true);
 assert.equal(created?.status,201);const body=await created!.json() as any;assert.equal(body.steps.length,3);assert.deepEqual(body.steps[1].depends_on,[body.steps[0].id]);assert.equal(body.steps[0].approval_required,true);assert.equal(body.execution,"not-started");assert.equal(writes,4);
 const listed=await jarvisOrchestrationRoute(req("GET"),env,async()=>true);assert.equal(listed?.status,200);
 const detail=await jarvisOrchestrationRoute(req("GET","/api/jarvis/orchestrations/orc_1"),env,async()=>true);assert.equal(detail?.status,200);
 assert.ok(sql.every(s=>s.includes("owner_scope='owner'")||s.includes("owner_scope")));
 console.log("J.A.R.V.I.S. orchestration planner tests passed");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
