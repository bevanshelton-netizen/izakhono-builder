import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const MANAGER_URL=(process.env.COMPUTE_MANAGER_URL||'http://compute-manager:8082').replace(/\/$/,'');
const ENROLLMENT_TOKEN=process.env.WORKER_ENROLLMENT_TOKEN||'';
const WORKER_ID=process.env.WORKER_ID||'izakhono-worker-01';
const DATA_DIR=process.env.WORKER_DATA_DIR||'/data';
const TOKEN_FILE=path.join(DATA_DIR,'worker-token');
const POLL_MS=Math.max(1000,Number(process.env.WORKER_POLL_MS||3000));
const CAPABILITIES=['health-check','sha256','echo'];
async function request(pathname,body,token){
 const response=await fetch(MANAGER_URL+pathname,{method:'POST',headers:{...(token?{authorization:`Bearer ${token}`}:{}),'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;
}
async function loadOrEnroll(){
 await fs.mkdir(DATA_DIR,{recursive:true});
 try{const token=(await fs.readFile(TOKEN_FILE,'utf8')).trim();if(token)return token}catch(e){if(e.code!=='ENOENT')throw e}
 if(!ENROLLMENT_TOKEN)throw new Error('WORKER_ENROLLMENT_TOKEN is required for first enrollment');
 const result=await request('/worker/register',{worker_id:WORKER_ID,enrollment_token:ENROLLMENT_TOKEN,hostname:os.hostname(),capabilities:CAPABILITIES,resources:{cpu_count:os.cpus().length,memory_mb:Math.round(os.totalmem()/1048576)}});
 const token=result.worker_token;if(!token)throw new Error('Manager did not issue a worker credential');
 const tmp=TOKEN_FILE+'.tmp';await fs.writeFile(tmp,token,{mode:0o600});await fs.rename(tmp,TOKEN_FILE);return token;
}
async function execute(job){
 if(job.type==='echo')return {echo:job.input};
 if(job.type==='sha256'){const value=String(job.input?.value??'');return {algorithm:'sha256',digest:crypto.createHash('sha256').update(value).digest('hex')}}
 if(job.type==='health-check')return {ok:true,hostname:os.hostname(),platform:os.platform(),arch:os.arch(),cpu_count:os.cpus().length,memory_mb:Math.round(os.totalmem()/1048576),uptime_seconds:Math.round(os.uptime()),checked_at:new Date().toISOString()};
 throw new Error('Unsupported task');
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let stopping=false;process.on('SIGTERM',()=>stopping=true);process.on('SIGINT',()=>stopping=true);
const token=await loadOrEnroll();
console.log(`IZAKHONO worker enrolled and authenticated: ${WORKER_ID}`);
while(!stopping){
 try{
  const claim=await request('/worker/claim',{worker_id:WORKER_ID},token);
  if(claim.job){const job=claim.job;try{const result=await execute(job);await request(`/worker/jobs/${job.id}/complete`,{worker_id:WORKER_ID,lease_token:job.lease_token,result},token)}catch(e){await request(`/worker/jobs/${job.id}/fail`,{worker_id:WORKER_ID,lease_token:job.lease_token,error:e.message},token)}}
  else await sleep(POLL_MS);
 }catch(e){console.error('worker loop:',e.message);await sleep(Math.min(POLL_MS*3,15000))}
}
console.log('IZAKHONO worker stopped');
