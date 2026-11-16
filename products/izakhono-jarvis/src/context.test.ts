import assert from "node:assert/strict";
import { jarvisContextRoute, jarvisTaskContextRoute } from "./context";

function req(method: string, body?: unknown, path="/api/jarvis/context") {
 return new Request("https://builder.example"+path,{method,headers:body===undefined?{}:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
}
async function main() {
 let reads=0,writes=0,lastSql="",lastValues:unknown[]=[];
 const env={DB:{prepare(sql:string){lastSql=sql;return{bind(...v:unknown[]){lastValues=v;return{
 async all(){reads++;assert.match(sql,/owner_scope='owner'/);return{results:[]};},
 async first(){reads++;assert.match(sql,/owner_scope='owner'|FROM builder_projects/);return{ id:"found" };},
 async run(){writes++;return{};}
 };}};}}};
 const denied=await jarvisContextRoute(req("GET"),env,async()=>false);assert.equal(denied?.status,401);assert.equal(reads,0);
 const badScope=await jarvisContextRoute(req("POST",{scope_type:"company",title:"x",content:"y"}),env,async()=>true);assert.equal(badScope?.status,400);
 const created=await jarvisContextRoute(req("POST",{scope_type:"project",scope_id:"prj_1",title:"KORA launch",content:"Approved scope"}),env,async()=>true);assert.equal(created?.status,201);assert.equal(writes,1);assert.equal(lastValues[0] && typeof lastValues[0],"string");
 assert.match(lastSql,/INSERT INTO jarvis_context_items/);
 const listed=await jarvisContextRoute(req("GET",undefined,"/api/jarvis/context?scope_type=project&scope_id=prj_1&limit=10"),env,async()=>true);assert.equal(listed?.status,200);assert.equal(reads,2);
 const badLimit=await jarvisContextRoute(req("GET",undefined,"/api/jarvis/context?limit=999"),env,async()=>true);assert.equal(badLimit?.status,400);
 const attached=await jarvisTaskContextRoute(req("POST",{context_id:"ctx_1"} ,"/api/jarvis/tasks/tsk_1/context"),env,async()=>true);assert.equal(attached?.status,201);assert.equal(writes,2);
 const deniedAttach=await jarvisTaskContextRoute(req("POST",{context_id:"ctx_1"},"/api/jarvis/tasks/tsk_1/context"),env,async()=>false);assert.equal(deniedAttach?.status,401);
 console.log("J.A.R.V.I.S. context API tests passed");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
