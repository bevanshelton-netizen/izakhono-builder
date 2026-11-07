import assert from "node:assert/strict";
import { jarvisApprovalsRoute } from "./approvals";
function req(method:string,body?:unknown,path="/api/jarvis/proposals"){return new Request("https://builder.example"+path,{method,headers:body===undefined?{}:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});}
async function main(){
 let reads=0,writes=0,sqls:string[]=[];
 const env={DB:{prepare(sql:string){sqls.push(sql);return{bind(..._v:unknown[]){return{
 async all(){reads++;return{results:[]};},
 async first(){reads++;return sql.includes("jarvis_action_proposals")?{id:"prp_1",status:"proposed",expires_at:null}:null;},
 async run(){writes++;return{meta:{changes:1}};}
 };}};}}};
 const denied=await jarvisApprovalsRoute(req("GET"),env,async()=>false);assert.equal(denied?.status,401);assert.equal(reads,0);
 const invalid=await jarvisApprovalsRoute(req("POST",{action_type:"shell_exec",title:"Run",description:"Do it"}),env,async()=>true);assert.equal(invalid?.status,400);
 const created=await jarvisApprovalsRoute(req("POST",{action_type:"prepare_report",title:"Board report",description:"Prepare a draft only",risk_level:"low"}),env,async()=>true);assert.equal(created?.status,201);assert.match(await created!.text(),/not-performed/);
 assert.ok(sqls.some(s=>s.includes("INSERT INTO jarvis_action_proposals")));
 const decision=await jarvisApprovalsRoute(req("POST",{decision:"approved",reason:"Reviewed and authorised for a later, separately confirmed execution."},"/api/jarvis/proposals/prp_1/decision"),env,async()=>true);assert.equal(decision?.status,201);assert.match(await decision!.text(),/No external action was executed/);
 const badDecision=await jarvisApprovalsRoute(req("POST",{decision:"approved",reason:"again"},"/api/jarvis/proposals/prp_1/decision"),env,async()=>true);assert.equal(badDecision?.status,409);
 const audit=await jarvisApprovalsRoute(req("GET",undefined,"/api/jarvis/audit?limit=20"),env,async()=>true);assert.equal(audit?.status,200);
 const badLimit=await jarvisApprovalsRoute(req("GET",undefined,"/api/jarvis/audit?limit=999"),env,async()=>true);assert.equal(badLimit?.status,400);
 assert.ok(sqls.some(s=>s.includes("INSERT INTO jarvis_audit_events")));assert.equal(writes,5);
 console.log("J.A.R.V.I.S. approvals and audit tests passed");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
