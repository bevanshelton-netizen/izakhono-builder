import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'izakhono-compute-'));
const port=19000+Math.floor(Math.random()*500);
const admin='test-admin-token',worker='test-worker-token';
const env={...process.env,PORT:String(port),DATA_DIR:dir,COMPUTE_ADMIN_TOKEN:admin,COMPUTE_WORKER_TOKEN:worker,COMPUTE_LEASE_MS:'15000'};
const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url).pathname,env,stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function req(url,token,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
try{
 let ready=false;for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await wait(100)}if(!ready)throw Error('manager failed to start');
 if((await req('/api/compute/summary','wrong')).status!==401)throw Error('admin auth gate failed');
 if((await req('/worker/register',worker,{worker_id:'worker-test-01',capabilities:['echo','sha256','health-check'],resources:{cpu_count:2,memory_mb:1024}})).status!==200)throw Error('worker registration failed');
 const queued=await req('/api/compute/jobs',admin,{type:'sha256',input:{value:'izakhono'}});if(queued.status!==202)throw Error('job submission failed');
 const claim=await req('/worker/claim',worker,{worker_id:'worker-test-01'});if(claim.status!==200||!claim.data.job)throw Error('job claim failed');
 const result=await req(`/worker/jobs/${claim.data.job.id}/complete`,worker,{worker_id:'worker-test-01',lease_token:claim.data.job.lease_token,result:{digest:'verified'}});if(result.status!==200)throw Error('job completion failed');
 const status=await req(`/api/compute/jobs/${claim.data.job.id}`,admin);if(status.data.job.status!=='succeeded')throw Error('job state persistence failed');
 if((await req('/worker/claim',worker,{worker_id:'worker-test-01'})).data.job!==null)throw Error('completed job was leased twice');
 console.log('IZAKHONO Compute Manager smoke test: PASS');
}finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true})}
