// Owner-controlled J.A.R.V.I.S. workforce queue. A claim is a lease, not proof of execution.
export interface WorkforceDb{prepare(sql:string):{bind(...values:unknown[]):{all<T=Record<string,unknown>>():Promise<{results?:T[]}>;first<T=Record<string,unknown>>():Promise<T|null>;run():Promise<{meta?:{changes?:number}}>}}}
export interface WorkforceEnv{DB:WorkforceDb}
const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const agents=new Set(["coordinator","business-analyst","research-briefing","project-planner","reporting"]);
const uid=()=>"wfe_"+crypto.randomUUID().replaceAll("-","");
export async function jarvisWorkforceRoute(req:Request,env:WorkforceEnv,owner:()=>Promise<boolean>):Promise<Response|null>{
 const u=new URL(req.url),p=u.pathname;if(!p.startsWith("/api/jarvis/workforce"))return null;
 if(!(await owner()))return out({ok:false,error:"Unauthorized"},401);
 if(p==="/api/jarvis/workforce"&&req.method==="GET"){
  const runs=await env.DB.prepare("SELECT id,objective,status,risk_level,created_at,updated_at FROM jarvis_orchestration_runs WHERE owner_scope='owner' ORDER BY created_at DESC LIMIT 30").bind().all();
  const steps=await env.DB.prepare("SELECT s.id,s.run_id,s.position,s.title,s.description,s.assigned_agent,s.status,s.attempts,s.max_attempts,s.lease_until,s.last_error,s.approval_required FROM jarvis_orchestration_steps s WHERE s.owner_scope='owner' ORDER BY s.run_id,s.position LIMIT 200").bind().all();
  return out({ok:true,runs:runs.results||[],steps:steps.results||[],execution_mode:"owner-controlled-queue",autonomous_workers_connected:false});
 }
 const claim=p==="/api/jarvis/workforce/claim",m=p.match(/^\/api\/jarvis\/workforce\/steps\/([^/]+)\/(heartbeat|complete|fail)$/),allowed=claim||m?["POST"]:["GET"];
 if(req.method!== (claim||m?"POST":"GET"))return new Response("Method not allowed",{status:405,headers:{allow:allowed.join(", "),"cache-control":"no-store"}});
 let b:any={};try{b=await req.json()}catch{return out({ok:false,error:"Expected JSON"},400)}
 if(claim){
  const agent=typeof b.agent_id==="string"?b.agent_id:"";if(!agents.has(agent))return out({ok:false,error:"Unknown agent"},400);
  await env.DB.prepare("UPDATE jarvis_orchestration_steps SET status=CASE WHEN attempts<max_attempts THEN 'retry' ELSE 'failed' END,lease_owner=NULL,lease_until=NULL,last_error='Worker lease expired',updated_at=CURRENT_TIMESTAMP WHERE owner_scope='owner' AND status='claimed' AND lease_until<=CURRENT_TIMESTAMP").bind().run();
  const c=await env.DB.prepare("SELECT s.id,s.run_id,s.title,s.description,s.attempts,s.max_attempts FROM jarvis_orchestration_steps s JOIN jarvis_orchestration_runs r ON r.id=s.run_id WHERE s.owner_scope='owner' AND r.owner_scope='owner' AND s.assigned_agent=? AND s.status IN ('pending','retry') AND s.attempts<s.max_attempts AND s.approval_required=0 AND NOT EXISTS (SELECT 1 FROM json_each(s.depends_on_json) d JOIN jarvis_orchestration_steps dep ON dep.id=d.value WHERE dep.status!='completed') ORDER BY r.created_at,s.position LIMIT 1").bind(agent).first<any>();
  if(!c)return out({ok:true,claimed:false,message:"No eligible step. Dependencies, approval or retry limits may be blocking work."});
  const lease=new Date(Date.now()+300000).toISOString(),r=await env.DB.prepare("UPDATE jarvis_orchestration_steps SET status='claimed',lease_owner=?,lease_until=?,attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_scope='owner' AND status IN ('pending','retry')").bind(agent,lease,c.id).run();
  if(!r.meta?.changes)return out({ok:true,claimed:false,message:"Another worker claimed this step. Retry."},409);
  await env.DB.prepare("UPDATE jarvis_orchestration_runs SET status='in_progress',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_scope='owner'").bind(c.run_id).run();
  await env.DB.prepare("INSERT INTO jarvis_audit_events(id,owner_scope,event_type,subject_type,subject_id,detail_json) VALUES(?,'owner','workforce.claimed','step',?,?)").bind(uid(),c.id,JSON.stringify({agent_id:agent,lease_until:lease})).run();
  return out({ok:true,claimed:true,step:{...c,assigned_agent:agent,lease_until:lease,status:"claimed"}});
 }
 const stepId=decodeURIComponent(m![1]),action=m![2],s=await env.DB.prepare("SELECT id,run_id,assigned_agent,status,attempts,max_attempts FROM jarvis_orchestration_steps WHERE id=? AND owner_scope='owner'").bind(stepId).first<any>();
 if(!s)return out({ok:false,error:"Step not found"},404);if(s.status!=="claimed")return out({ok:false,error:"Step is not claimed"},409);if(b.agent_id!==s.assigned_agent)return out({ok:false,error:"Claim belongs to another agent"},409);
 if(action==="heartbeat"){const lease=new Date(Date.now()+300000).toISOString();await env.DB.prepare("UPDATE jarvis_orchestration_steps SET lease_until=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='claimed' AND assigned_agent=?").bind(lease,stepId,b.agent_id).run();return out({ok:true,lease_until:lease});}
 let status:string;
 if(action==="complete"){const evidence=typeof b.evidence==="string"?b.evidence.trim():"";if(evidence.length<8||evidence.length>2000)return out({ok:false,error:"Completion evidence (8–2000 characters) is required"},400);status="completed";await env.DB.prepare("UPDATE jarvis_orchestration_steps SET status='completed',evidence_json=?,lease_until=NULL,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='claimed'").bind(JSON.stringify({evidence,verified_by_owner:false}),stepId).run();}
 else{const error=typeof b.error==="string"?b.error.trim().slice(0,1000):"Worker reported failure";status=s.attempts<s.max_attempts?"retry":"failed";await env.DB.prepare("UPDATE jarvis_orchestration_steps SET status=?,last_error=?,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='claimed'").bind(status,error,stepId).run();}
 await env.DB.prepare("INSERT INTO jarvis_audit_events(id,owner_scope,event_type,subject_type,subject_id,detail_json) VALUES(?,'owner',?,'step',?,?)").bind(uid(),"workforce."+status,stepId,JSON.stringify({agent_id:b.agent_id,evidence:b.evidence||null,error:b.error||null})).run();
 const left=await env.DB.prepare("SELECT COUNT(*) AS n FROM jarvis_orchestration_steps WHERE run_id=? AND owner_scope='owner' AND status NOT IN ('completed','cancelled')").bind(s.run_id).first<any>();
 if(Number(left?.n||0)===0)await env.DB.prepare("UPDATE jarvis_orchestration_runs SET status='completed',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_scope='owner'").bind(s.run_id).run();
 return out({ok:true,step_id:stepId,status,completion_is_owner_verified:false});
}