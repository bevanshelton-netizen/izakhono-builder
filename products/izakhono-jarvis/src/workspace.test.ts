import assert from "node:assert/strict";
import {jarvisWorkspaceRoute} from "./workspace";
function req(path="/api/jarvis/workspace",method="GET"){return new Request("https://builder.example"+path,{method});}
async function main(){
 let reads=0,sql:string[]=[];
 const env={DB:{prepare(s:string){sql.push(s);return{bind(..._v:unknown[]){return{async all(){reads++;return{results:[]};}};}};}}};
 const denied=await jarvisWorkspaceRoute(req(),env,async()=>false);assert.equal(denied?.status,401);assert.equal(reads,0);
 const invalid=await jarvisWorkspaceRoute(req("/api/jarvis/workspace?limit=99"),env,async()=>true);assert.equal(invalid?.status,400);assert.equal(reads,0);
 const wrong=await jarvisWorkspaceRoute(req("/api/jarvis/workspace","POST"),env,async()=>true);assert.equal(wrong?.status,405);
 const result=await jarvisWorkspaceRoute(req(),env,async()=>true);assert.equal(result?.status,200);assert.equal(reads,3);
 const body=await result!.json() as any;assert.equal(body.workspace.execution,"read-only");assert.equal(body.workspace.financials.revenue_zar,null);
 assert.equal(sql.length,3);assert.ok(sql.every(s=>s.includes("owner_scope='owner'")));
 assert.equal(await jarvisWorkspaceRoute(req("/api/jarvis/other"),env,async()=>true),null);
 console.log("J.A.R.V.I.S. executive workspace tests passed");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
