// IZAKHONO mainframe read-only bridge: first-party Builder and J.A.R.V.I.S. records only.
export interface JarvisMainframeDb {
 prepare(sql:string):{all<T=Record<string,unknown>>():Promise<{results?:T[]}>;first<T=Record<string,unknown>>():Promise<T|null>;bind(...values:unknown[]):{all<T=Record<string,unknown>>():Promise<{results?:T[]}>;first<T=Record<string,unknown>>():Promise<T|null>}};
}
export interface JarvisMainframeEnv{DB:JarvisMainframeDb;IZAKHONO_SUPER_AI_URL?:string;IZAKHONO_SUPER_AI_INTERNAL_KEY?:string;IZAKHONO_SUPER_AI_WORKFLOW_KEY?:string;}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function jarvisMainframeRoute(req:Request,env:JarvisMainframeEnv,ownerAuthorized:()=>Promise<boolean>):Promise<Response|null>{
 const path=new URL(req.url).pathname;
 if(path!=="/api/jarvis/mainframe/status"&&path!=="/api/jarvis/mainframe/overview")return null;
 if(req.method!=="GET")return new Response("Method not allowed",{status:405,headers:{allow:"GET","cache-control":"no-store"}});
 if(!(await ownerAuthorized()))return json({ok:false,error:"Unauthorized"},401);
 try{
  const [projects,tasks,proposals,context,events]=await Promise.all([
   env.DB.prepare("SELECT status,COUNT(*) AS total FROM builder_projects GROUP BY status").all<any>(),
   env.DB.prepare("SELECT status,COUNT(*) AS total FROM jarvis_tasks WHERE owner_scope='owner' GROUP BY status").all<any>(),
   env.DB.prepare("SELECT status,COUNT(*) AS total FROM jarvis_action_proposals WHERE owner_scope='owner' GROUP BY status").all<any>(),
   env.DB.prepare("SELECT COUNT(*) AS total FROM jarvis_context_items WHERE owner_scope='owner'").first<any>(),
   env.DB.prepare("SELECT id,event_type,subject_type,subject_id,created_at FROM jarvis_audit_events WHERE owner_scope='owner' ORDER BY created_at DESC LIMIT 10").all<any>()
  ]);
  const counts=(rows:any[])=>Object.fromEntries((rows||[]).map(r=>[String(r.status),Number(r.total||0)]));
  const aiConfigured=Boolean(env.IZAKHONO_SUPER_AI_URL&&env.IZAKHONO_SUPER_AI_INTERNAL_KEY&&env.IZAKHONO_SUPER_AI_WORKFLOW_KEY);
  const overview={observed_at:new Date().toISOString(),mainframe:"IZAKHONO BUILDER / J.A.R.V.I.S. D1",connection:"first-party-read-only",portfolio:{by_status:counts(projects.results||[]),total:(projects.results||[]).reduce((n:any,r:any)=>n+Number(r.total||0),0)},assistant:{tasks_by_status:counts(tasks.results||[]),proposals_by_status:counts(proposals.results||[]),context_items:Number(context?.total||0),recent_activity:events.results||[]},services:{reasoning_gateway:aiConfigured?"configured-not-yet-runtime-verified":"not-configured",finance:"not-connected",email:"not-connected",calendar:"not-connected",crm:"not-connected",manufacturing:"not-connected",education:"not-connected"},permissions:{portfolio:"read-only",tasks:"owner-managed",proposals:"owner-approval-required",external_actions:"disabled"},limitations:["Only first-party Builder and J.A.R.V.I.S. D1 records are queried.","A configured gateway is not proof of successful connectivity.","Finance, email, calendar, CRM, manufacturing and education systems have no verified live adapters in this bridge."]};
  return json({ok:true,overview});
 }catch{return json({ok:false,error:"IZAKHONO mainframe data source unavailable",connection:"unavailable"},503);}
}
