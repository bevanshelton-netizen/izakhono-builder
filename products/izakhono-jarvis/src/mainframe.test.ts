import assert from "node:assert/strict";
import {jarvisMainframeRoute} from "./mainframe";
const req=()=>new Request("https://builder.example/api/jarvis/mainframe/overview");
async function main(){
 let reads=0;
 const env={DB:{prepare(sql:string){const result={async all(){reads++;return{results:sql.includes("builder_projects")?[{status:"draft",total:2}]:[]}},async first(){reads++;return{total:4}}};return{...result,bind(){return result}}}},IZAKHONO_SUPER_AI_URL:"https://ai.example",IZAKHONO_SUPER_AI_INTERNAL_KEY:"x",IZAKHONO_SUPER_AI_WORKFLOW_KEY:"y"};
 const denied=await jarvisMainframeRoute(req(),env,async()=>false);assert.equal(denied?.status,401);assert.equal(reads,0);
 const ok=await jarvisMainframeRoute(req(),env,async()=>true);assert.equal(ok?.status,200);const body=await ok!.json() as any;assert.equal(body.overview.portfolio.total,2);assert.equal(body.overview.assistant.context_items,4);assert.equal(body.overview.services.reasoning_gateway,"configured-not-yet-runtime-verified");assert.equal(body.overview.permissions.external_actions,"disabled");assert.equal(reads,5);
 console.log("J.A.R.V.I.S. mainframe bridge tests passed");
}
main().catch(e=>{console.error(e);process.exitCode=1});
