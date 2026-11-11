import { getJarvisAgent } from "./agents";

// IZAKHONO-owned SUPER AI gateway adapter. Secrets remain server-side; no browser/provider credentials.
export interface JarvisReasoningEnv {
 IZAKHONO_SUPER_AI_URL?:string;
 IZAKHONO_SUPER_AI_INTERNAL_KEY?:string;
 IZAKHONO_SUPER_AI_WORKFLOW_KEY?:string;
 JARVIS_AI_FETCH?:typeof fetch;
}
type Plan={objective:string;steps:{title:string;description:string;depends_on:number[]}[];assumptions:string[];missing_evidence:string[];risk_level:"low"|"medium"|"high"|"critical";owner_decisions:string[]};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const allowed=new Set(["coordinator","business-analyst","research-briefing","project-planner","reporting"]);
function validPlan(v:any):v is Plan {
 if(!v||typeof v!=="object"||typeof v.objective!=="string"||v.objective.length>500)return false;
 if(!Array.isArray(v.steps)||v.steps.length<1||v.steps.length>12)return false;
 if(!v.steps.every((s:any,i:number)=>s&&typeof s.title==="string"&&s.title.length>0&&s.title.length<=240&&typeof s.description==="string"&&s.description.length<=1200&&Array.isArray(s.depends_on)&&s.depends_on.every((n:any)=>Number.isInteger(n)&&n>=1&&n<=i)))return false;
 if(!Array.isArray(v.assumptions)||v.assumptions.length>12||!v.assumptions.every((x:any)=>typeof x==="string"&&x.length<=500))return false;
 if(!Array.isArray(v.missing_evidence)||v.missing_evidence.length>12||!v.missing_evidence.every((x:any)=>typeof x==="string"&&x.length<=500))return false;
 if(!["low","medium","high","critical"].includes(v.risk_level))return false;
 return Array.isArray(v.owner_decisions)&&v.owner_decisions.length<=12&&v.owner_decisions.every((x:any)=>typeof x==="string"&&x.length<=500);
}
export async function jarvisReasoningRoute(req:Request,env:JarvisReasoningEnv,ownerAuthorized:()=>Promise<boolean>):Promise<Response|null>{
 const url=new URL(req.url);if(url.pathname!=="/api/jarvis/reason")return null;
 if(req.method!=="POST")return new Response("Method not allowed",{status:405,headers:{allow:"POST","cache-control":"no-store"}});
 if(!(await ownerAuthorized()))return json({ok:false,error:"Unauthorized"},401);
 let p:any;try{p=await req.json()}catch{return json({ok:false,error:"Expected application/json"},400)}
 if(!p||typeof p!=="object"||Array.isArray(p))return json({ok:false,error:"Expected a JSON object"},400);
 const instruction=typeof p.instruction==="string"?p.instruction.trim():"",agentId=typeof p.agent_id==="string"?p.agent_id:"coordinator";
 if(!instruction||instruction.length>4000)return json({ok:false,error:"instruction is required and must be 1–4000 characters"},400);
 if(!allowed.has(agentId))return json({ok:false,error:"Unknown reasoning agent"},400);
 const agent=getJarvisAgent(agentId);if(!agent)return json({ok:false,error:"Agent unavailable"},503);
 const base=env.IZAKHONO_SUPER_AI_URL,key=env.IZAKHONO_SUPER_AI_INTERNAL_KEY,workflowKey=env.IZAKHONO_SUPER_AI_WORKFLOW_KEY;
 if(!base||!key||!workflowKey)return json({ok:false,error:"IZAKHONO SUPER AI gateway is not configured",provider_status:"not-configured",execution:"not-started"},503);
 let endpoint:URL;try{endpoint=new URL(base.replace(/\\/+$/,"")+"/api/v1/generate")}catch{return json({ok:false,error:"IZAKHONO SUPER AI gateway URL is invalid"},503)}
 if(endpoint.protocol!=="https:")return json({ok:false,error:"IZAKHONO SUPER AI gateway must use HTTPS"},503);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const doFetch=env.JARVIS_AI_FETCH||fetch;
  const response=await doFetch(endpoint.toString(),{method:"POST",headers:{"content-type":"application/json","x-izakhono-ai-key":key,"x-izakhono-ai-workflow-key":workflowKey},signal:controller.signal,body:JSON.stringify({
   entity_id:"izakhono-africa",product:"izakhono-jarvis",access_mode:"workflow",capability:"reasoning",
   messages:[
    {role:"system",content:"You are the "+agent.name+" for IZAKHONO J.A.R.V.I.S. Purpose: "+agent.purpose+" Responsibilities: "+agent.responsibilities.join("; ")+". Boundaries: "+agent.boundaries.join("; ")+". Produce a cautious work plan only. Never claim to have accessed evidence or completed actions. Clearly list assumptions, missing evidence, and owner decisions. Output JSON only with keys objective, steps (1-12 objects with title, description, depends_on as 1-based prior step numbers), assumptions, missing_evidence, risk_level (low|medium|high|critical), owner_decisions."},
    {role:"user",content:instruction}
   ]
  })});
  if(!response.ok)return json({ok:false,error:"IZAKHONO SUPER AI gateway returned an unsuccessful response",provider_status:response.status},502);
  const envelope:any=await response.json(),content=envelope?.output?.text||envelope?.answer;
  if(typeof content!=="string")return json({ok:false,error:"SUPER AI returned no structured content"},502);
  let plan:any;try{plan=JSON.parse(content)}catch{return json({ok:false,error:"SUPER AI response was not valid JSON"},502)}
  if(!validPlan(plan))return json({ok:false,error:"SUPER AI response failed plan validation"},502);
  return json({ok:true,agent:{id:agent.id,name:agent.name},plan,provider:"IZAKHONO SUPER AI",provider_status:"response-verified",persistence:"not-saved",execution:"not-started",owner_approval_required:true});
 }catch(error){return json({ok:false,error:error instanceof Error&&error.name==="AbortError"?"IZAKHONO SUPER AI timed out":"IZAKHONO SUPER AI request failed",provider_status:"unavailable"},502)}
 finally{clearTimeout(timer)}
}
