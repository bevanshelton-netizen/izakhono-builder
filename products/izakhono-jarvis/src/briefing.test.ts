import assert from "node:assert/strict";
import {jarvisBriefingRoute} from "./briefing";
function req(path="/api/jarvis/briefing",method="GET"){return new Request("https://builder.example"+path,{method});}
async function main(){
 let reads=0;const tables=[
  [{id:"a",title:"Overdue",status:"open",priority:"normal",due_at:"2026-11-10"} ,{id:"b",title:"Today",status:"open",priority:"normal",due_at:"2026-11-11"},{id:"c",title:"Urgent",status:"in_progress",priority:"urgent",due_at:null}],
  [{id:"p",title:"Approve funding",action_type:"financial_action",risk_level:"critical"}],
  [{event_type:"task.created",subject_type:"task",subject_id:"a",created_at:"2026-11-11"}]
 ];
 const env={DB:{prepare(_sql:string){return{bind(..._args:unknown[]){return{async all(){return{results:tables[reads++]};}};}};}}};
 const denied=await jarvisBriefingRoute(req(),env,async()=>false);assert.equal(denied?.status,401);assert.equal(reads,0);
 assert.equal((await jarvisBriefingRoute(req("/api/jarvis/briefing","POST"),env,async()=>true))?.status,405);
 const original=Date;globalThis.Date=class extends Date{constructor(...args:any[]){super(...(args.length?args:["2026-11-11T08:00:00.000Z"]) as [any]);}static now(){return new Date("2026-11-11T08:00:00.000Z").getTime();}} as DateConstructor;
 const response=await jarvisBriefingRoute(req(),env,async()=>true);globalThis.Date=original;
 assert.equal(response?.status,200);const body=await response!.json() as any;
 assert.equal(body.briefing.counts.overdue_tasks,1);assert.equal(body.briefing.counts.due_today,1);assert.equal(body.briefing.counts.pending_decisions,1);
 assert.equal(body.briefing.attention[0].kind,"owner-decision");assert.equal(body.briefing.attention[1].kind,"overdue-task");
 assert.equal(body.briefing.limitations.length,3);assert.equal(await jarvisBriefingRoute(req("/other"),env,async()=>true),null);
 console.log("J.A.R.V.I.S. daily briefing tests passed");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
