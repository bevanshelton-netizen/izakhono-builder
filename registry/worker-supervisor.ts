import {WORKERS,WORKER_INDEX} from './workers';
import {createRuntime,Job} from './runtime';

const runtime=createRuntime();
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const now=()=>new Date().toISOString();

export async function workerControl(request:Request,authorized:boolean){
 if(!authorized)return json({ok:false,error:'unauthorized'},401);
 const url=new URL(request.url);
 if(url.pathname==='/workers/status'&&request.method==='GET'){
  const counts={total:WORKERS.length,low:0,medium:0,high:0,ready:0,gateRequired:0};
  for(const w of WORKERS){counts[w.risk]++;if(w.humanGate)counts.gateRequired++;else counts.ready++;}
  return json({ok:true,online:true,generatedAt:now(),counts,workers:WORKERS.map(w=>({id:w.id,domain:w.domain,risk:w.risk,humanGate:w.humanGate||null,ready:true,handler:'generic-control-plane-adapter'}))});
 }
 if(url.pathname==='/workers/dispatch'&&request.method==='POST'){
  let body:{workerId?:string;input?:unknown;dryRun?:boolean};try{body=await request.json();}catch{return json({ok:false,error:'invalid json'},400);}
  if(!body.workerId||!WORKER_INDEX[body.workerId])return json({ok:false,error:'unknown worker'},404);
  const w=WORKER_INDEX[body.workerId];
  const job:Job={id:crypto.randomUUID(),workerId:w.id,input:body.input??{},status:'queued',attempts:0,createdAt:now(),updatedAt:now()};
  if(w.humanGate&&!body.dryRun)return json({ok:true,accepted:true,job,status:'blocked',reason:'human-gate-required',gate:w.humanGate},202);
  job.status='running';job.attempts=1;job.updatedAt=now();
  const result=await runtime.run(job,{requestId:job.id,dryRun:body.dryRun??true,metadata:{domain:w.domain}});
  job.status=result.status;job.updatedAt=now();
  return json({ok:true,accepted:true,job,result},result.status==='succeeded'?200:202);
 }
 return json({ok:false,error:'not found'},404);
}
