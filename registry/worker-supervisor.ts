import {WORKERS,WORKER_INDEX} from './workers';
import {D1Database} from './d1-store';
import {discoverBuilderQueue,classifyBuilderIssue,shouldIngest} from './builder-queue';
import {ensureSupervisorSchema,upsertSupervisorJob,listSupervisorJobs,supervisorCounts,transitionSupervisorJob,recordEvidence,SupervisorJob} from './supervisor-store';

const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const now=()=>new Date().toISOString();
const idFor=(source:string,sourceId:string)=>`job:${source}:${sourceId}`;

export async function workerControl(request:Request,authorized:boolean,db:D1Database){
 if(!authorized)return json({ok:false,error:'unauthorized'},401);
 await ensureSupervisorSchema(db);
 const url=new URL(request.url);
 if(url.pathname==='/workers/status'&&request.method==='GET'){
  const counts={total:WORKERS.length,low:0,medium:0,high:0,gateRequired:0};
  for(const w of WORKERS){counts[w.risk]++;if(w.humanGate)counts.gateRequired++;}
  return json({ok:true,catalogReady:true,generatedAt:now(),workerCounts:counts,queue:await supervisorCounts(db)});
 }
 if(url.pathname==='/workers/queue'&&request.method==='GET'){
  try{
   const discovered=await discoverBuilderQueue();
   const ingested=[];
   for(const issue of discovered){if(!shouldIngest(issue))continue;const c=classifyBuilderIssue(issue);const job:SupervisorJob={id:idFor('github-issue',String(issue.number)),source:'github-issue',sourceId:String(issue.number),title:issue.title,workerId:c.workerId,priority:c.priority,risk:c.risk,status:c.risk==='high'?'blocked':'queued',dependencyIds:c.dependencyIds,humanGate:c.humanGate,attempts:0,input:{issueNumber:issue.number,url:issue.html_url,body:issue.body??''},evidence:{source:'github',discoveredAt:now()},createdAt:now(),updatedAt:now()};await upsertSupervisorJob(db,job);ingested.push(job.id);}
   return json({ok:true,discovered:discovered.length,ingested:ingested.length,queue:await listSupervisorJobs(db)});
  }catch(error){return json({ok:false,error:String(error)},502);}
 }
 if(url.pathname==='/workers/jobs'&&request.method==='GET'){
  const status=url.searchParams.get('status') as SupervisorJob['status']|null;
  return json({ok:true,counts:await supervisorCounts(db),jobs:await listSupervisorJobs(db,status||undefined)});
 }
 if(url.pathname==='/workers/dispatch'&&request.method==='POST'){
  let body:{jobId?:string;workerId?:string;input?:unknown;dryRun?:boolean};
  try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(body.jobId){
   const jobs=await listSupervisorJobs(db);const job=jobs.find(j=>j.id===body.jobId);if(!job)return json({ok:false,error:'unknown job'},404);
   if(job.risk==='high'||job.humanGate)return json({ok:true,accepted:false,status:'blocked',job,reason:'human-gate-required',gate:job.humanGate||'high-risk'},202);
   if(job.dependencyIds.length){const blockers=jobs.filter(j=>job.dependencyIds.includes(j.sourceId)&&j.status!=='completed');if(blockers.length)return json({ok:true,accepted:false,status:'blocked',job,reason:'dependencies-incomplete',blockers},202);}
   const transitioned=await transitionSupervisorJob(db,job.id,'running','worker-supervisor',{mode:body.dryRun?'dry-run':'dispatch'});
   return json({ok:true,accepted:true,status:'running',job:transitioned,note:'Queued for an installed worker handler; no completion is claimed until machine-readable evidence is recorded.'},202);
  }
  if(!body.workerId||!WORKER_INDEX[body.workerId])return json({ok:false,error:'unknown worker'},404);
  const w=WORKER_INDEX[body.workerId];
  const sourceId=`manual:${crypto.randomUUID()}`;const job:SupervisorJob={id:idFor('manual',sourceId),source:'manual',sourceId,title:`Manual ${w.id} job`,workerId:w.id,priority:10,risk:w.risk,status:w.humanGate?'blocked':'queued',dependencyIds:[],humanGate:w.humanGate,attempts:0,input:body.input??{},evidence:{createdAt:now()},createdAt:now(),updatedAt:now()};await upsertSupervisorJob(db,job);
  return json({ok:true,accepted:job.status!=='blocked',status:job.status,job,reason:job.humanGate?'human-gate-required':undefined},job.status==='blocked'?202:201);
 }
 if(url.pathname==='/workers/verify'&&request.method==='POST'){
  let body:{jobId?:string;evidence?:unknown};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.jobId)return json({ok:false,error:'jobId required'},400);const jobs=await listSupervisorJobs(db);const job=jobs.find(j=>j.id===body.jobId);if(!job)return json({ok:false,error:'unknown job'},404);if(!body.evidence)return json({ok:false,error:'machine-readable evidence required'},400);await recordEvidence(db,job.id,body.evidence);const transitioned=await transitionSupervisorJob(db,job.id,'verified','evidence-gate',{evidence:body.evidence});return json({ok:true,status:'verified',job:transitioned});
 }
 if(url.pathname==='/workers/complete'&&request.method==='POST'){
  let body:{jobId?:string;evidence?:unknown};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.jobId)return json({ok:false,error:'jobId required'},400);const jobs=await listSupervisorJobs(db);const job=jobs.find(j=>j.id===body.jobId);if(!job)return json({ok:false,error:'unknown job'},404);if(job.status!=='verified')return json({ok:false,error:'completion requires verified state'},409);if(!body.evidence)return json({ok:false,error:'completion evidence required'},400);await recordEvidence(db,job.id,{verification:job.evidence,completion:body.evidence});const transitioned=await transitionSupervisorJob(db,job.id,'completed','completion-gate',{evidence:body.evidence});return json({ok:true,status:'completed',job:transitioned});
 }
 return json({ok:false,error:'not found'},404);
}
