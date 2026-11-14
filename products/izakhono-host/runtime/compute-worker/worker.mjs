import os from 'node:os';
import crypto from 'node:crypto';

const MANAGER_URL=(process.env.COMPUTE_MANAGER_URL||'http://compute-manager:8082').replace(/\/$/,'');
const TOKEN=process.env.COMPUTE_WORKER_TOKEN||'';
const WORKER_ID=process.env.WORKER_ID||'izakhono-worker-01';
const POLL_MS=Math.max(1000,Number(process.env.WORKER_POLL_MS||3000));
const CAPABILITIES=['health-check','sha256','echo'];
if(!TOKEN)throw new Error('COMPUTE_WORKER_TOKEN is required');
async function call(path,body){const r=await fetch(MANAGER_URL+path,{method:'POST',headers:{authorization:`Bearer ${TOKEN}`,'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data}
async function execute(job){
  if(job.type==='echo')return {echo:job.input};
  if(job.type==='sha256'){const value=String(job.input?.value??'');return {algorithm:'sha256',digest:crypto.createHash('sha256').update(value).digest('hex')}}
  if(job.type==='health-check')return {ok:true,hostname:os.hostname(),platform:os.platform(),arch:os.arch(),cpu_count:os.cpus().length,memory_mb:Math.round(os.totalmem()/1048576),uptime_seconds:Math.round(os.uptime()),checked_at:new Date().toISOString()};
  throw new Error('Unsupported job type');
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let stopping=false;process.on('SIGTERM',()=>stopping=true);process.on('SIGINT',()=>stopping=true);
await call('/worker/register',{worker_id:WORKER_ID,hostname:os.hostname(),capabilities:CAPABILITIES,resources:{cpu_count:os.cpus().length,memory_mb:Math.round(os.totalmem()/1048576)}});
console.log(`IZAKHONO worker online: ${WORKER_ID}`);
while(!stopping){
  try{
    const claim=await call('/worker/claim',{worker_id:WORKER_ID});
    if(claim.job){const job=claim.job;try{const result=await execute(job);await call(`/worker/jobs/${job.id}/complete`,{worker_id:WORKER_ID,lease_token:job.lease_token,result})}catch(e){await call(`/worker/jobs/${job.id}/fail`,{worker_id:WORKER_ID,lease_token:job.lease_token,error:e.message})}}
    else await sleep(POLL_MS);
  }catch(e){console.error('worker loop:',e.message);await sleep(Math.min(POLL_MS*3,15000))}
}
console.log('IZAKHONO worker stopped');
