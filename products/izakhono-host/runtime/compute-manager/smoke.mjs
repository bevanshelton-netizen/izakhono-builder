import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const dir=await mkdtemp(path.join(tmpdir(),'izakhono-compute-'));
const port=19000+Math.floor(Math.random()*500);
const admin='test-admin-token',worker='test-worker-token';
const base=`http://127.0.0.1:${port}`;
const common={...process.env,DATA_DIR:dir,COMPUTE_ADMIN_TOKEN:admin,COMPUTE_WORKER_TOKEN:worker};
const manager=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url).pathname,env:{...common,PORT:String(port),COMPUTE_LEASE_MS:'15000'},stdio:'ignore'});
let agent;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function req(url,token,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
try{
 let ready=false;for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await wait(100)}if(!ready)throw Error('manager failed to start');
 if((await req('/api/compute/summary','wrong')).status!==401)throw Error('admin auth gate failed');
 agent=spawn(process.execPath,['../compute-worker/worker.mjs'],{cwd:new URL('.',import.meta.url).pathname,env:{...common,COMPUTE_MANAGER_URL:base,WORKER_ID:'worker-test-01',WORKER_POLL_MS:'100'},stdio:'ignore'});
 let registered=false;for(let i=0;i<50;i++){const nodes=await req('/api/compute/nodes',admin);if(nodes.data.nodes.some(n=>n.id==='worker-test-01')){registered=true;break}await wait(100)}if(!registered)throw Error('worker process did not register');
 const value='izakhono sovereign compute';
 const queued=await req('/api/compute/jobs',admin,{type:'sha256',input:{value}});if(queued.status!==202)throw Error('job submission failed');
 let completed=null;for(let i=0;i<100;i++){const status=await req(`/api/compute/jobs/${queued.data.job.id}`,admin);if(status.data.job.status==='succeeded'){completed=status.data.job;break}if(status.data.job.status==='failed')throw Error(status.data.job.error);await wait(100)}if(!completed)throw Error('worker did not complete job');
 const expected=crypto.createHash('sha256').update(value).digest('hex');if(completed.result?.digest!==expected)throw Error('worker result did not match expected SHA-256');
 const summary=await req('/api/compute/summary',admin);if(summary.data.nodes<1)throw Error('node inventory missing');
 console.log('IZAKHONO Compute Manager + real worker integration test: PASS');
}finally{
 if(agent){agent.kill('SIGTERM');await new Promise(r=>agent.once('exit',r))}
 manager.kill('SIGTERM');await new Promise(r=>manager.once('exit',r));await rm(dir,{recursive:true,force:true})
}
