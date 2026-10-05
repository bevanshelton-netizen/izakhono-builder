import {WORKERS,WORKER_INDEX} from './workers';
import {createRuntime} from './runtime';
import {D1Database} from './d1-store';
import {WorkerJobStore,SupervisorJob} from './worker-job-store';

const runtime=createRuntime();
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const now=()=>new Date().toISOString();

type Body={workerId?:string;input?:unknown;dryRun?:boolean;jobId?:string;priority?:number;source?:string;evidence?:unknown};

export async function workerControl(request:Request,authorized:boolean,db?:D1Database){
 if(!authorized)return json({ok:false,error:'unauthorized'},401);
 if(!db)return json({ok:false,error:'worker-store-unavailable'},503);
 const store=new WorkerJobStore(db); await store.init();
 const url=new URL(request.url);
 if(url.pathname==='/workers/status'&&request.method==='GET'){
  const counts={total:WORKERS.length,low:0,medium:0,high:0,gateRequired:0};
  for(const w of WORKERS){counts[w.risk]++;if(w.humanGate)counts.gateRequired++;}
  return json({ok:true,online:true,generatedAt:now(),counts,jobs:await store.counts(),workers:WORKERS.map(w=>({id:w.id,domain:w.domain,risk:w.risk,humanGate:w.humanGate||null,ready:true}))});
 }
 if(url.pathname==='/workers/jobs'&&request.method==='GET'){
  const status=url.searchParams.get('status') as SupervisorJob['status']|null;
  return json({ok:true,jobs:await store.list(status||undefined)});
 }
 if(url.pathname==='/workers/dispatch'&&request.method==='POST'){
  let body:Body;try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.workerId||!WORKER_INDEX[body.workerId])return json({ok:false,error:'unknown worker'},404);
  const w=WORKER_INDEX[body.workerId];
  const id=body.jobId||crypto.randomUUID();
  const job:SupervisorJob={id,workerId:w.id,input:body.input??{},status:'queued',attempts:0,priority:Math.max(0,Math.min(100,body.priority??50)),risk:w.risk,gate:w.humanGate,source:body.source,createdAt:now(),updatedAt:now()};
  if(w.humanGate&&!body.dryRun){job.status='blocked';await store.put(job);return json({ok:true,accepted:true,job,reason:'human-gate-required',gate:w.humanGate},202);}
  job.status='running';job.attempts=1;job.updatedAt=now();await store.put(job);
  try{
   if(!runtime.worker(w.id).handler)runtime.registerWorker(w,async(j)=>({workerId:w.id,domain:w.domain,mission:w.mission,jobId:j.id,mode:body.dryRun?'dry-run':'controlled'}));
   const result=await runtime.run({id:job.id,workerId:job.workerId,input:job.input,status:'running',attempts:job.attempts,createdAt:job.createdAt,updatedAt:job.updatedAt},{requestId:job.id,dryRun:body.dryRun??false,metadata:{domain:w.domain}});
   if(result.status==='succeeded'){job.status='verified';job.evidence=body.evidence??{workerReceipt:result,verifiedAt:now()};job.status='completed';}
   else job.status='failed';
   job.updatedAt=now();await store.put(job);return json({ok:true,accepted:true,job,result},job.status==='completed'?200:202);
  }catch(error){job.status='failed';job.lastError=error instanceof Error?error.message:String(error);job.updatedAt=now();await store.put(job);return json({ok:false,accepted:true,job,error:job.lastError},500);}
 }
 return json({ok:false,error:'not found'},404);
}
