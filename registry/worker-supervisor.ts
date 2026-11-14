import {WORKERS,WORKER_INDEX} from './workers';
import {executeLeasedSupervisorJob, type SupervisorWorkerHandlers} from './worker-executor';
import {D1Database} from './d1-store';
import {discoverBuilderQueue,classifyBuilderIssue,shouldIngest} from './builder-queue';
import {ensureSupervisorSchema,upsertSupervisorJob,listSupervisorJobs,supervisorCounts,transitionSupervisorJob,recordEvidence,SupervisorJob,claimSupervisorLease,heartbeatSupervisorLease,finishSupervisorLease,recoverExpiredSupervisorLeases,SupervisorLease} from './supervisor-store';

const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const now=()=>new Date().toISOString();
const idFor=(source:string,sourceId:string)=>`job:${source}:${sourceId}`;

async function ingestDiscovered(db:D1Database){
 const discovered=await discoverBuilderQueue();
 const ingested=[];
 for(const issue of discovered){if(!shouldIngest(issue))continue;const c=classifyBuilderIssue(issue);const job:SupervisorJob={id:idFor('github-issue',String(issue.number)),source:'github-issue',sourceId:String(issue.number),title:issue.title,workerId:c.workerId,priority:c.priority,risk:c.risk,status:c.risk==='high'?'blocked':'queued',dependencyIds:c.dependencyIds,humanGate:c.humanGate,attempts:0,input:{issueNumber:issue.number,url:issue.html_url,body:issue.body??''},evidence:{source:'github',discoveredAt:now()},createdAt:now(),updatedAt:now()};await upsertSupervisorJob(db,job);ingested.push(job.id);}
 return {discovered:discovered.length,ingested:ingested.length};
}

function ready(job:SupervisorJob,jobs:SupervisorJob[]){
 if(job.status!=='queued'||job.risk==='high'||job.humanGate)return false;
 if(!job.dependencyIds.length)return true;
 return !jobs.some(j=>job.dependencyIds.some(dep=>dep===j.sourceId||dep===j.id)&&j.status!=='completed');
}

export async function advanceReadyWorkers(db:D1Database,limit=25,eligibleWorkerIds:readonly string[]=[]){
 await recoverExpiredSupervisorLeases(db);
 const jobs=await listSupervisorJobs(db);
 const advanced=[];
 for(const job of jobs.sort((a,b)=>b.priority-a.priority)){
  if(advanced.length>=limit)break;
  if(!ready(job,jobs)||!eligibleWorkerIds.includes(job.workerId))continue;
  const lease=await claimSupervisorLease(db,job.id,job.workerId,`supervisor:${job.id}:${job.attempts+1}`);
  if(lease)advanced.push({jobId:job.id,workerId:job.workerId,status:'leased',lease,attempt:lease.attempt});
 }
 return advanced;
}

export async function runBuildWorkerCycle(db:D1Database,handlers:SupervisorWorkerHandlers,limit=5){
 await recoverExpiredSupervisorLeases(db);
 const jobs=await listSupervisorJobs(db);
 const results=[];
 for(const job of jobs.filter(j=>j.workerId==='build-worker'&&ready(j,jobs)).sort((a,b)=>b.priority-a.priority)){
  if(results.length>=limit)break;
  const input=job.input as Record<string,unknown>|null;
  if(!input||typeof input.repository!=='string'||typeof input.revision!=='string'||!Array.isArray(input.checks))continue;
  const lease=await claimSupervisorLease(db,job.id,job.workerId,`build-cycle:${job.id}:${job.attempts+1}`);
  if(!lease)continue;
  results.push(await executeLeasedSupervisorJob(db,lease,handlers));
 }
 return results;
}

export async function pumpWorkers(db:D1Database,handlers?:SupervisorWorkerHandlers){
 await ensureSupervisorSchema(db);
 const ingestion=await ingestDiscovered(db);
 const executed=handlers?await runBuildWorkerCycle(db,handlers):[];
 const advanced=await advanceReadyWorkers(db,25,[]);
 return {ok:true,generatedAt:now(),...ingestion,executed:executed.length,executionResults:executed,advanced:advanced.length,jobs:advanced};
}

export async function workerControl(request:Request,authorized:boolean,db:D1Database,handlers?:SupervisorWorkerHandlers){
 if(!authorized)return json({ok:false,error:'unauthorized'},401);
 await ensureSupervisorSchema(db);
 const url=new URL(request.url);
 if(url.pathname==='/workers/status'&&request.method==='GET'){
  const counts={total:WORKERS.length,low:0,medium:0,high:0,gateRequired:0};
  for(const w of WORKERS){counts[w.risk]++;if(w.humanGate)counts.gateRequired++;}
  return json({ok:true,catalogReady:true,generatedAt:now(),workerCounts:counts,queue:await supervisorCounts(db)});
 }
 if(url.pathname==='/workers/queue'&&request.method==='GET'){
  try{return json({ok:true,...await ingestDiscovered(db),queue:await listSupervisorJobs(db)});}catch(error){return json({ok:false,error:String(error)},502);}
 }
 if(url.pathname==='/workers/pump'&&(request.method==='POST'||request.method==='GET')){
  try{return json(await pumpWorkers(db,handlers));}catch(error){return json({ok:false,error:String(error)},502);}
 }
 if(url.pathname==='/workers/jobs'&&request.method==='GET'){
  const status=url.searchParams.get('status') as SupervisorJob['status']|null;
  return json({ok:true,counts:await supervisorCounts(db),jobs:await listSupervisorJobs(db,status||undefined)});
 }
 if(url.pathname==='/workers/claim'&&request.method==='POST'){
  let body:{jobId?:string;workerId?:string;idempotencyKey?:string;leaseSeconds?:number};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.jobId||!body.workerId||!body.idempotencyKey)return json({ok:false,error:'jobId, workerId and idempotencyKey required'},400);
  try{const lease=await claimSupervisorLease(db,body.jobId,body.workerId,body.idempotencyKey,body.leaseSeconds);return lease?json({ok:true,lease},201):json({ok:false,error:'job unavailable, gated, already leased, or no longer queued'},409);}catch(error){return json({ok:false,error:String(error)},409);}
 }
 if(url.pathname==='/workers/heartbeat'&&request.method==='POST'){
  let body:{lease?:SupervisorLease;leaseSeconds?:number};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.lease)return json({ok:false,error:'lease required'},400);
  try{const renewed=await heartbeatSupervisorLease(db,body.lease,body.leaseSeconds);return json({ok:renewed,renewed},renewed?200:409);}catch(error){return json({ok:false,error:String(error)},400);}
 }
 if(url.pathname==='/workers/finish'&&request.method==='POST'){
  let body:{lease?:SupervisorLease;outcome?:'verified'|'failed'|'blocked';detail?:unknown};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.lease||!body.outcome)return json({ok:false,error:'lease and outcome required'},400);
  if(!['verified','failed','blocked'].includes(body.outcome))return json({ok:false,error:'invalid outcome'},400);
  try{const finished=await finishSupervisorLease(db,body.lease,body.outcome,body.detail??{});return json({ok:finished,finished},finished?200:409);}catch(error){return json({ok:false,error:String(error)},400);}
 }
 if(url.pathname==='/workers/dispatch'&&request.method==='POST'){
  let body:{jobId?:string;workerId?:string;input?:unknown;dryRun?:boolean};
  try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(body.jobId){
   const jobs=await listSupervisorJobs(db);const job=jobs.find(j=>j.id===body.jobId);if(!job)return json({ok:false,error:'unknown job'},404);
   if(job.status!=='queued')return json({ok:false,error:`job is ${job.status}, expected queued`},409);
   if(!handlers?.[job.workerId])return json({ok:true,accepted:false,status:'queued',job,reason:'worker-executor-unavailable'},202);
   if(job.risk==='high'||job.humanGate)return json({ok:true,accepted:false,status:'blocked',job,reason:'human-gate-required',gate:job.humanGate||'high-risk'},202);
   if(job.dependencyIds.length){const blockers=jobs.filter(j=>job.dependencyIds.some(dep=>dep===j.sourceId||dep===j.id)&&j.status!=='completed');if(blockers.length)return json({ok:true,accepted:false,status:'blocked',job,reason:'dependencies-incomplete',blockers},202);}
   const lease=await claimSupervisorLease(db,job.id,job.workerId,`dispatch:${job.id}:${job.attempts+1}`);
   if(!lease)return json({ok:false,accepted:false,error:'job could not be exclusively leased'},409);
   return json({ok:true,accepted:true,status:'leased',lease,note:'Lease granted. A registered worker must execute the bounded task and submit its evidence.'},202);
  }
  if(!body.workerId||!WORKER_INDEX[body.workerId])return json({ok:false,error:'unknown worker'},404);
  const w=WORKER_INDEX[body.workerId];
  const sourceId=`manual:${crypto.randomUUID()}`;const job:SupervisorJob={id:idFor('manual',sourceId),source:'manual',sourceId,title:`Manual ${w.id} job`,workerId:w.id,priority:10,risk:w.risk,status:w.humanGate?'blocked':'queued',dependencyIds:[],humanGate:w.humanGate,attempts:0,input:body.input??{},evidence:{createdAt:now()},createdAt:now(),updatedAt:now()};await upsertSupervisorJob(db,job);
  return json({ok:true,accepted:job.status!=='blocked',status:job.status,job,reason:job.humanGate?'human-gate-required':undefined},job.status==='blocked'?202:201);
 }
 if(url.pathname==='/workers/verify'&&request.method==='POST'){
  let body:{jobId?:string;evidence?:unknown};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.jobId)return json({ok:false,error:'jobId required'},400);const jobs=await listSupervisorJobs(db);const job=jobs.find(j=>j.id===body.jobId);if(!job)return json({ok:false,error:'unknown job'},404);if(job.status!=='running')return json({ok:false,error:'verification requires running state'},409);if(!body.evidence)return json({ok:false,error:'machine-readable evidence required'},400);await recordEvidence(db,job.id,body.evidence);const transitioned=await transitionSupervisorJob(db,job.id,'verified','evidence-gate',{evidence:body.evidence});const advanced=await advanceReadyWorkers(db);return json({ok:true,status:'verified',job:transitioned,advanced:advanced.length});
 }
 if(url.pathname==='/workers/complete'&&request.method==='POST'){
  let body:{jobId?:string;evidence?:unknown};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.jobId)return json({ok:false,error:'jobId required'},400);const jobs=await listSupervisorJobs(db);const job=jobs.find(j=>j.id===body.jobId);if(!job)return json({ok:false,error:'unknown job'},404);if(job.status!=='verified')return json({ok:false,error:'completion requires verified state'},409);if(!body.evidence)return json({ok:false,error:'completion evidence required'},400);await recordEvidence(db,job.id,{verification:job.evidence,completion:body.evidence});const transitioned=await transitionSupervisorJob(db,job.id,'completed','completion-gate',{evidence:body.evidence});const advanced=await advanceReadyWorkers(db);return json({ok:true,status:'completed',job:transitioned,advanced:advanced.length});
 }
 return json({ok:false,error:'not found'},404);
}
