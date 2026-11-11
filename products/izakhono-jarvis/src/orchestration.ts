// Deterministic orchestration planner. It persists owner briefs and ordered steps; it does not invoke models or execute actions.
export interface JarvisOrchestrationDb {
 prepare(sql:string):{bind(...values:unknown[]):{all<T=Record<string,unknown>>():Promise<{results?:T[]}>;first<T=Record<string,unknown>>():Promise<T|null>;run():Promise<unknown>}};
}
export interface JarvisOrchestrationEnv{DB:JarvisOrchestrationDb;}
const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const AGENTS=new Set(["coordinator","business-analyst","research-briefing","project-planner","reporting"]);
const RISKS=new Set(["low","medium","high","critical"]);
const uid=(p:string)=>p+"_"+crypto.randomUUID().replaceAll("-","");
function validStrings(v:unknown,max:number):v is string[]{return Array.isArray(v)&&v.length>0&&v.length<=max&&v.every(x=>typeof x==="string"&&x.trim().length>0&&x.length<=240);}
export async function jarvisOrchestrationRoute(req:Request,env:JarvisOrchestrationEnv,ownerAuthorized:()=>Promise<boolean>):Promise<Response|null>{
 const url=new URL(req.url),path=url.pathname;
 const collection=path==="/api/jarvis/orchestrations",item=path.match(/^\/api\/jarvis\/orchestrations\/([^/]+)$/);
 if(!collection&&!item)return null;
 const methods=collection?["GET","POST"]:["GET"];
 if(!methods.includes(req.method))return new Response("Method not allowed",{status:405,headers:{allow:methods.join(", "),"cache-control":"no-store"}});
 if(!(await ownerAuthorized()))return out({ok:false,error:"Unauthorized"},401);
 if(req.method==="GET"){
  const raw=url.searchParams.get("limit"),limit=raw===null?20:Number(raw);
  if(!Number.isInteger(limit)||limit<1||limit>50)return out({ok:false,error:"limit must be 1–50"},400);
  if(item){
   const id=decodeURIComponent(item[1]);
   const run=await env.DB.prepare("SELECT id,instruction,objective,agent_id,status,risk_level,evidence_json,created_at,updated_at FROM jarvis_orchestration_runs WHERE owner_scope='owner' AND id=?").bind(id).first();
   if(!run)return out({ok:false,error:"Orchestration brief not found"},404);
   const steps=await env.DB.prepare("SELECT id,position,title,description,assigned_agent,depends_on_json,status,approval_required FROM jarvis_orchestration_steps WHERE owner_scope='owner' AND run_id=? ORDER BY position").bind(id).all();
   return out({ok:true,run,steps:steps.results||[],execution:"not-started"});
  }
  const rows=await env.DB.prepare("SELECT id,objective,agent_id,status,risk_level,created_at FROM jarvis_orchestration_runs WHERE owner_scope='owner' ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  return out({ok:true,orchestrations:rows.results||[],limit});
 }
 let p:any;try{p=await req.json()}catch{return out({ok:false,error:"Expected application/json"},400)}
 if(!p||typeof p!=="object"||Array.isArray(p))return out({ok:false,error:"Expected a JSON object"},400);
 const instruction=typeof p.instruction==="string"?p.instruction.trim():"";
 const objective=typeof p.objective==="string"?p.objective.trim():"";
 const agent=typeof p.agent_id==="string"?p.agent_id:"coordinator";
 const risk=typeof p.risk_level==="string"?p.risk_level:"medium";
 if(!instruction||instruction.length>4000||!objective||objective.length>500)return out({ok:false,error:"instruction (1–4000) and objective (1–500) are required"},400);
 if(!AGENTS.has(agent))return out({ok:false,error:"Unknown reasoning agent"},400);
 if(!RISKS.has(risk))return out({ok:false,error:"Invalid risk level"},400);
 if(!validStrings(p.steps,12))return out({ok:false,error:"Provide 1–12 non-empty steps, each no longer than 240 characters"},400);
 const descriptions=Array.isArray(p.step_descriptions)?p.step_descriptions:[];
 if(descriptions.length&& (descriptions.length!==p.steps.length||!descriptions.every((x:unknown)=>typeof x==="string"&&x.length<=1200)))return out({ok:false,error:"step_descriptions must match steps and be at most 1200 characters each"},400);
 const runId=uid("orc");
 await env.DB.prepare("INSERT INTO jarvis_orchestration_runs(id,owner_scope,instruction,objective,agent_id,status,risk_level,evidence_json) VALUES(?,'owner',?,?,?,'planned',?,'[]')").bind(runId,instruction,objective,agent,risk).run();
 const steps=[];
 for(let i=0;i<p.steps.length;i++){
  const stepId=uid("stp"),title=p.steps[i].trim(),description=(descriptions[i]||title).trim(),depends=i?[steps[i-1].id]:[];
  await env.DB.prepare("INSERT INTO jarvis_orchestration_steps(id,run_id,owner_scope,position,title,description,assigned_agent,depends_on_json,status,approval_required) VALUES(?,?, 'owner',?,?,?,?,?,'pending',?)")
   .bind(stepId,runId,i+1,title,description,agent,JSON.stringify(depends),risk==="high"||risk==="critical"?1:0).run();
  steps.push({id:stepId,position:i+1,title,description,assigned_agent:agent,depends_on:depends,status:"pending",approval_required:risk==="high"||risk==="critical"});
 }
 return out({ok:true,run:{id:runId,instruction,objective,agent_id:agent,status:"planned",risk_level:risk,evidence:[]},steps,execution:"not-started",message:"Work brief persisted. No reasoning model, external integration or action executor was invoked."},201);
}
