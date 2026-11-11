// Single owner-only read model for the executive workspace. No mutations or external calls.
export interface JarvisWorkspaceDb {
 prepare(sql:string):{bind(...values:unknown[]):{all<T=Record<string,unknown>>():Promise<{results?:T[]}>}};
}
export interface JarvisWorkspaceEnv{DB:JarvisWorkspaceDb;}
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function jarvisWorkspaceRoute(req:Request,env:JarvisWorkspaceEnv,ownerAuthorized:()=>Promise<boolean>):Promise<Response|null>{
 const url=new URL(req.url);if(url.pathname!=="/api/jarvis/workspace")return null;
 if(req.method!=="GET")return new Response("Method not allowed",{status:405,headers:{allow:"GET","cache-control":"no-store"}});
 if(!(await ownerAuthorized()))return respond({ok:false,error:"Unauthorized"},401);
 const raw=url.searchParams.get("limit"),limit=raw===null?10:Number(raw);
 if(!Number.isInteger(limit)||limit<1||limit>25)return respond({ok:false,error:"limit must be an integer from 1 to 25"},400);
 try{
  const [tasks,proposals,audit]=await Promise.all([
   env.DB.prepare("SELECT id,title,status,priority,due_at,updated_at FROM jarvis_tasks WHERE owner_scope='owner' AND status NOT IN ('done','cancelled') ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,updated_at DESC LIMIT ?").bind(limit).all(),
   env.DB.prepare("SELECT id,action_type,title,risk_level,status,created_at FROM jarvis_action_proposals WHERE owner_scope='owner' AND status='proposed' ORDER BY created_at DESC LIMIT ?").bind(limit).all(),
   env.DB.prepare("SELECT id,event_type,subject_type,subject_id,created_at FROM jarvis_audit_events WHERE owner_scope='owner' ORDER BY created_at DESC LIMIT ?").bind(limit).all()
  ]);
  return respond({ok:true,workspace:{generated_at:new Date().toISOString(),scope:"owner",tasks:tasks.results||[],pending_proposals:proposals.results||[],recent_activity:audit.results||[],financials:{status:"unavailable",revenue_zar:null,cash_position_zar:null},execution:"read-only"}});
 }catch{return respond({ok:false,error:"Workspace data source unavailable"},503);}
}
