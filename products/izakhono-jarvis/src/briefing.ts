// Deterministic owner-only daily briefing built from first-party J.A.R.V.I.S. records.
export interface JarvisBriefingDb {
 prepare(sql:string):{bind(...values:unknown[]):{all<T=Record<string,unknown>>():Promise<{results?:T[]}>}};
}
export interface JarvisBriefingEnv{DB:JarvisBriefingDb;}
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function jarvisBriefingRoute(req:Request,env:JarvisBriefingEnv,ownerAuthorized:()=>Promise<boolean>):Promise<Response|null>{
 const url=new URL(req.url);if(url.pathname!=="/api/jarvis/briefing")return null;
 if(req.method!=="GET")return new Response("Method not allowed",{status:405,headers:{allow:"GET","cache-control":"no-store"}});
 if(!(await ownerAuthorized()))return respond({ok:false,error:"Unauthorized"},401);
 try{
  const [tasks,proposals,audit]=await Promise.all([
   env.DB.prepare("SELECT id,title,status,priority,due_at,updated_at FROM jarvis_tasks WHERE owner_scope='owner' AND status NOT IN ('done','cancelled') ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,updated_at DESC LIMIT 100").bind().all<any>(),
   env.DB.prepare("SELECT id,title,action_type,risk_level,created_at FROM jarvis_action_proposals WHERE owner_scope='owner' AND status='proposed' ORDER BY CASE risk_level WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,created_at ASC LIMIT 50").bind().all<any>(),
   env.DB.prepare("SELECT event_type,subject_type,subject_id,created_at FROM jarvis_audit_events WHERE owner_scope='owner' ORDER BY created_at DESC LIMIT 5").bind().all<any>()
  ]);
  const now=new Date(),today=now.toISOString().slice(0,10),taskRows=tasks.results||[],proposalRows=proposals.results||[];
  const overdue=taskRows.filter(t=>t.due_at&&String(t.due_at).slice(0,10)<today);
  const dueToday=taskRows.filter(t=>t.due_at&&String(t.due_at).slice(0,10)===today);
  const urgent=taskRows.filter(t=>t.priority==="urgent"||t.priority==="high");
  const attention=[
   ...proposalRows.map(p=>({kind:"owner-decision",priority:p.risk_level==="critical"?"critical":p.risk_level==="high"?"high":"normal",title:p.title,detail:"Approval requested for "+String(p.action_type).replaceAll("_"," "),id:p.id})),
   ...overdue.map(t=>({kind:"overdue-task",priority:"high",title:t.title,detail:"Past due · "+t.due_at,id:t.id})),
   ...dueToday.map(t=>({kind:"due-today",priority:"normal",title:t.title,detail:"Due today",id:t.id})),
   ...urgent.filter(t=>!overdue.includes(t)&&!dueToday.includes(t)).map(t=>({kind:"priority-task",priority:t.priority,title:t.title,detail:"Open "+t.status+" task",id:t.id}))
  ].sort((a,b)=>({critical:0,high:1,normal:2,low:3}[a.priority as "critical"|"high"|"normal"|"low"]??3)-({critical:0,high:1,normal:2,low:3}[b.priority as "critical"|"high"|"normal"|"low"]??3)).slice(0,15);
  return respond({ok:true,briefing:{observed_at:now.toISOString(),date:today,source:"first-party J.A.R.V.I.S. records",counts:{open_tasks:taskRows.length,overdue_tasks:overdue.length,due_today:dueToday.length,high_or_urgent_tasks:urgent.length,pending_decisions:proposalRows.length},attention,recent_activity:audit.results||[],limitations:["This briefing only covers records stored in J.A.R.V.I.S. D1.","Email, calendar, finance and external operating systems are not included until their connectors are authorised and verified.","Priority ordering is rule-based; it is not a claim that every business obligation has been captured."]}});
 }catch{return respond({ok:false,error:"Briefing data source unavailable"},503);}
}
