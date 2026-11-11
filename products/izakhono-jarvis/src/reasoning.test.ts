import assert from "node:assert/strict";
import {jarvisReasoningRoute} from "./reasoning";
const make=(body:unknown)=>new Request("https://builder.example/api/jarvis/reason",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
async function main(){
 let calls=0;
 const plan={objective:"Create a delivery plan",steps:[{title:"Verify inputs",description:"Collect evidence",depends_on:[]},{title:"Draft plan",description:"Prepare recommendation",depends_on:[1]}],assumptions:["Dates not supplied"],missing_evidence:["Approved budget"],risk_level:"medium",owner_decisions:["Approve scope"]};
 const env={JARVIS_AI_ENDPOINT:"https://provider.example/v1/chat/completions",JARVIS_AI_API_KEY:"test-secret",JARVIS_AI_MODEL:"test-model",JARVIS_AI_FETCH:async(_url:any,init:any)=>{calls++;assert.equal(init.headers.authorization,"Bearer test-secret");return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(plan)}}]}),{status:200,headers:{"content-type":"application/json"}})}};
 const denied=await jarvisReasoningRoute(make({instruction:"Plan"}),env,async()=>false);assert.equal(denied?.status,401);assert.equal(calls,0);
 const noConfig=await jarvisReasoningRoute(make({instruction:"Plan"}),{},async()=>true);assert.equal(noConfig?.status,503);assert.equal(calls,0);
 const ok=await jarvisReasoningRoute(make({instruction:"Create a delivery plan"}),env,async()=>true);assert.equal(ok?.status,200);const result=await ok!.json() as any;assert.equal(result.plan.steps.length,2);assert.equal(result.execution,"not-started");assert.equal(calls,1);
 const badEnv={...env,JARVIS_AI_FETCH:async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({...plan,steps:[{title:"x",description:"x",depends_on:[1]}]})}}]}),{status:200})};
 const bad=await jarvisReasoningRoute(make({instruction:"Plan"}),badEnv,async()=>true);assert.equal(bad?.status,502);
 console.log("J.A.R.V.I.S. reasoning adapter tests passed");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
