import {WORKERS,WORKER_INDEX} from './workers';
import {D1Database} from './d1-store';
import {discoverBuilderQueue,classifyBuilderIssue,shouldIngest} from './builder-queue';
import {ensureSupervisorSchema,upsertSupervisorJob,listSupervisorJobs,supervisorCounts,claimSupervisorJob,recoverExpiredSupervisorLeases,transitionSupervisorJob,recordEvidence,SupervisorJob} from './supervisor-store';
import {executeWorker,hasWorkerHandler,executableWorkerIds} from './worker-execution';
import {DIVISIONS,workersForDivision} from './divisions';

const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const now=()=>new Date().toISOString();
const idFor=(source:string,sourceId:string)=>`job:${source}:${sourceId}`;

async function ingestDiscovered(db:D1Database){
 const discovered=await discoverBuilderQueue();
 const ingested=[];
 for(const issue of discovered){if(!shouldIngest(issue))continue;const c=classifyBuilderIssue(issue);const job:SupervisorJob={id:idFor('github-issue',String(issue.number)),source:'github-issue',sourceId:String(issue.number),title:issue.title,workerId:c.workerId,priority:c.priority,risk:c.risk,status:c.risk==='high'?'blocked':'queued',dependencyIds:c.dependencyIds,humanGate:c.humanGate,attempts:0,input:{issueNumber:issue.number,title:issue.title,url:issue.html_url,body:issue.body??''},evidence:{source:'github',discoveredAt:now()},createdAt:now(),updatedAt:now()};await upsertSupervisorJob(db,job);ingested.push(job.id);}
 return {discovered:discovered.length,ingested:ingested.length};
}

function ready(job:SupervisorJob,jobs:SupervisorJob[]){
 if(job.status!=='queued'||job.risk==='high'||job.humanGate||!hasWorkerHandler(job.workerId))return false;
 if(!job.dependencyIds.length)return true;
 return !jobs.some(j=>job.dependencyIds.some(dep=>dep===j.sourceId||dep===j.id)&&j.status!=='completed');
}

async function executeClaimedJob(db:D1Database,job:SupervisorJob,actor:string){
 const claimed=await claimSupervisorJob(db,job.id,actor);
 if(!claimed)return {id:job.id,workerId:job.workerId,status:'not-claimed',reason:'another executor claimed or changed the job'};
 try{
  const execution=await executeWorker(WORKER_INDEX[job.workerId],job.input);
  await recordEvidence(db,job.id,{execution,verification:{status:'pending',required:true},recordedAt:now()});
  return {id:job.id,workerId:job.workerId,status:'running',attempts:claimed.attempts,leaseExpiresAt:claimed.leaseExpiresAt,execution,verification:'pending'};
 }catch(error){
  const detail={workerId:job.workerId,error:error instanceof Error?error.message:String(error),failedAt:now()};
  await recordEvidence(db,job.id,{executionFailure:detail});
  const failed=await transitionSupervisorJob(db,job.id,'failed',actor,{reason:'worker-execution-failed',...detail});
  return {...failed,workerId:job.workerId,error:detail.error};
 }
}

export async function advanceReadyWorkers(db:D1Database,limit=25){
 const jobs=await listSupervisorJobs(db);
 const advanced=[];
 for(const job of jobs.sort((a,b)=>b.priority-a.priority)){
  if(advanced.length>=limit)break;
  if(!ready(job,jobs))continue;
  advanced.push(await executeClaimedJob(db,job,'continuous-supervisor'));
 }
 return advanced;
}

export async function pumpWorkers(db:D1Database){
 await ensureSupervisorSchema(db);
 const leaseRecovery=await recoverExpiredSupervisorLeases(db,3,50);
 const ingestion=await ingestDiscovered(db);
 const advanced=await advanceReadyWorkers(db);
 const queue=await supervisorCounts(db);
 return {ok:true,generatedAt:now(),leaseRecovery,...ingestion,advanced:advanced.length,queue,jobs:advanced};
}

export async function workerControl(request:Request,authorized:boolean,db:D1Database,verifierAuthorized=false){
 if(!authorized)return json({ok:false,error:'unauthorized'},401);
 await ensureSupervisorSchema(db);
 const url=new URL(request.url);
 if(url.pathname==='/workers/status'&&request.method==='GET'){
  const counts={total:WORKERS.length,low:0,medium:0,high:0,gateRequired:0,executable:0};
  for(const w of WORKERS){counts[w.risk]++;if(w.humanGate)counts.gateRequired++;if(hasWorkerHandler(w.id))counts.executable++;}
  return json({ok:true,catalogReady:true,generatedAt:now(),workerCounts:counts,executableWorkers:executableWorkerIds(),queue:await supervisorCounts(db)});
 }
 if(url.pathname==='/workers/divisions'&&request.method==='GET'){
  return json({ok:true,generatedAt:now(),divisionCount:DIVISIONS.length,divisions:DIVISIONS.map(division=>({...division,workers:workersForDivision(division.id).map(worker=>({id:worker.id,domain:worker.domain,risk:worker.risk,humanGate:worker.humanGate??null,executable:hasWorkerHandler(worker.id)}))}))});
 }
 if(url.pathname==='/workers/queue'&&request.method==='GET'){
  try{return json({ok:true,...await ingestDiscovered(db),queue:await listSupervisorJobs(db)});}catch(error){return json({ok:false,error:String(error)},502);}
 }
 if(url.pathname==='/workers/pump'&&(request.method==='POST'||request.method==='GET')){
  try{return json(await pumpWorkers(db));}catch(error){return json({ok:false,error:String(error)},502);}
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
   if(job.status!=='queued')return json({ok:false,error:`job is ${job.status}, expected queued`},409);
   if(job.risk==='high'||job.humanGate)return json({ok:true,accepted:false,status:'blocked',job,reason:'human-gate-required',gate:job.humanGate||'high-risk'},202);
   if(job.dependencyIds.length){const blockers=jobs.filter(j=>job.dependencyIds.some(dep=>dep===j.sourceId||dep===j.id)&&j.status!=='completed');if(blockers.length)return json({ok:true,accepted:false,status:'blocked',job,reason:'dependencies-incomplete',blockers},202);}
   if(!hasWorkerHandler(job.workerId))return json({ok:true,accepted:false,status:'queued',job,reason:'worker-handler-not-registered'},202);
   if(body.dryRun)return json({ok:true,accepted:false,status:'queued',dryRun:true,preview:{jobId:job.id,workerId:job.workerId,handlerAvailable:true},note:'Dry run only; no state transition or handler execution occurred.'},200);
   return json({ok:true,accepted:true,...await executeClaimedJob(db,job,'worker-supervisor')},202);
  }
  if(!body.workerId||!WORKER_INDEX[body.workerId])return json({ok:false,error:'unknown worker'},404);
  const w=WORKER_INDEX[body.workerId];
  const sourceId=`manual:${crypto.randomUUID()}`;const job:SupervisorJob={id:idFor('manual',sourceId),source:'manual',sourceId,title:`Manual ${w.id} job`,workerId:w.id,priority:10,risk:w.risk,status:w.humanGate||w.risk==='high'?'blocked':'queued',dependencyIds:[],humanGate:w.humanGate,attempts:0,input:body.input??{},evidence:{createdAt:now()},createdAt:now(),updatedAt:now()};await upsertSupervisorJob(db,job);
  if(job.status==='blocked')return json({ok:true,accepted:false,status:'blocked',job,reason:'human-gate-required',gate:job.humanGate||'high-risk'},202);
  if(!hasWorkerHandler(w.id))return json({ok:true,accepted:false,status:'queued',job,reason:'worker-handler-not-registered'},202);
  if(body.dryRun)return json({ok:true,accepted:false,status:'queued',dryRun:true,preview:{jobId:job.id,workerId:job.workerId,handlerAvailable:true},note:'Dry run only; no state transition or handler execution occurred.'},200);
  return json({ok:true,accepted:true,...await executeClaimedJob(db,job,'worker-supervisor')},202);
 }
 if(url.pathname==='/workers/verify'&&request.method==='POST'){
  if(!verifierAuthorized)return json({ok:false,error:'independent QA verifier credential required'},403);
  let body:{jobId?:string;evidence?:unknown};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.jobId)return json({ok:false,error:'jobId required'},400);const jobs=await listSupervisorJobs(db);const job=jobs.find(j=>j.id===body.jobId);if(!job)return json({ok:false,error:'unknown job'},404);if(job.status!=='running')return json({ok:false,error:'verification requires running state'},409);if(!body.evidence)return json({ok:false,error:'machine-readable evidence required'},400);await recordEvidence(db,job.id,{execution:job.evidence,independentVerification:body.evidence});const transitioned=await transitionSupervisorJob(db,job.id,'verified','evidence-gate',{evidence:body.evidence});const advanced=await advanceReadyWorkers(db);return json({ok:true,status:'verified',job:transitioned,advanced:advanced.length});
 }
 if(url.pathname==='/workers/complete'&&request.method==='POST'){
  let body:{jobId?:string;evidence?:unknown};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.jobId)return json({ok:false,error:'jobId required'},400);const jobs=await listSupervisorJobs(db);const job=jobs.find(j=>j.id===body.jobId);if(!job)return json({ok:false,error:'unknown job'},404);if(job.status!=='verified')return json({ok:false,error:'completion requires verified state'},409);if(!body.evidence)return json({ok:false,error:'completion evidence required'},400);await recordEvidence(db,job.id,{verification:job.evidence,completion:body.evidence});const transitioned=await transitionSupervisorJob(db,job.id,'completed','completion-gate',{evidence:body.evidence});const advanced=await advanceReadyWorkers(db);return json({ok:true,status:'completed',job:transitioned,advanced:advanced.length});
 }
 return json({ok:false,error:'not found'},404);
}
