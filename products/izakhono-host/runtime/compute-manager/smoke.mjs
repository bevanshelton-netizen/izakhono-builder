import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const dir=await mkdtemp(path.join(tmpdir(),'izakhono-compute-'));
const port=19000+Math.floor(Math.random()*500);
const admin='test-admin-token',base=`http://127.0.0.1:${port}`;
const common={...process.env,DATA_DIR:dir,COMPUTE_ADMIN_TOKEN:admin};
const manager=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url).pathname,env:{...common,PORT:String(port),COMPUTE_LEASE_MS:'15000'},stdio:'ignore'});
let agent;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function req(url,token,body){const headers={'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;const r=await fetch(base+url,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
try{
 let ready=false;for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await wait(100)}if(!ready)throw Error('manager failed to start');
 if((await req('/api/compute/summary','wrong')).status!==401)throw Error('admin auth gate failed');
 const enrolled=await req('/api/compute/nodes/enroll',admin,{worker_id:'worker-test-01'});if(enrolled.status!==201||!enrolled.data.enrollment_token)throw Error('one-time enrollment issuance failed');
 agent=spawn(process.execPath,['../compute-worker/worker.mjs'],{cwd:new URL('.',import.meta.url).pathname,env:{...common,COMPUTE_MANAGER_URL:base,WORKER_ID:'worker-test-01',WORKER_POLL_MS:'100',WORKER_ENROLLMENT_TOKEN:enrolled.data.enrollment_token,WORKER_DATA_DIR:path.join(dir,'worker')},stdio:'ignore'});
 let registered=false;for(let i=0;i<50;i++){const nodes=await req('/api/compute/nodes',admin);if(nodes.data.nodes.some(n=>n.id==='worker-test-01'&&n.status==='online')){registered=true;break}await wait(100)}if(!registered)throw Error('worker process did not enroll');
 if((await req('/worker/register',null,{worker_id:'worker-test-01',enrollment_token:enrolled.data.enrollment_token})).status!==401)throw Error('one-time enrollment token was reusable');
 const tokenFile=path.join(dir,'worker','worker-worker-test-01.token');
 if(!(await readFile(tokenFile,'utf8')).trim())throw Error('worker credential was not persisted');
 if(((await stat(tokenFile)).mode&0o777)!==0o600)throw Error('worker credential file permissions are not 0600');
 if((await req('/worker/claim','wrong-worker-token',{worker_id:'worker-test-01})).status!==401)throw Error('per-worker credential isolation failed');
 const drained=await req('/api/compute/nodes/worker-test-01/drain',admin,{});if(drained.status!==200||drained.data.node.status!=='draining')throw Error('node drain control failed');
 const cancelCandidate=await req('/api/compute/jobs',admin,{type:'echo',input:{test:'cancel'}});if(cancelCandidate.status!==202)throw Error('cancel test job submission failed');
 await wait(350);
 const stillQueued=await req(`/api/compute/jobs/${cancelCandidate.data.job.id}`,admin);if(stillQueued.data.job.status!=='queued')throw Error('draining worker claimed new work');
 const cancelled=await req(`/api/compute/jobs/${cancelCandidate.data.job.id}/cancel`,admin,{});if(cancelled.status!==200||cancelled.data.job.status!=='cancelled')throw Error('queued job cancellation failed');
 const resumed=await req('/api/compute/nodes/worker-test-01/resume',admin,{});if(resumed.status!==200||resumed.data.node.status!=='online')throw Error('node resume control failed');
 const value='izakhono sovereign compute';
 const queued=await req('/api/compute/jobs',admin,{type:'sha256',input:{value}});if(queued.status!==202)throw Error('job submission failed');
 let completed=null;for(let i=0;i<100;i++){const status=await req(`/api/compute/jobs/${queued.data.job.id}`,admin);if(status.data.job.status==='succeeded'){completed=status.data.job;break}if(status.data.job.status==='failed')throw Error(status.data.job.error);await wait(100)}if(!completed)throw Error('worker did not complete job');
 const expected=crypto.createHash('sha256').update(value).digest('hex');if(completed.result?.digest!==expected)throw Error('worker result did not match expected SHA-256');
 const summary=await req('/api/compute/summary',admin);if(summary.data.nodes<1)throw Error('node inventory missing');
 await new Promise(resolve=>{agent.once('exit',resolve);agent.kill('SIGTERM')});agent=null;
 agent=spawn(process.execPath,['../compute-worker/worker.mjs'],{cwd:new URL('.',import.meta.url).pathname,env:{...common,COMPUTE_MANAGER_URL:base,WORKER_ID:'worker-test-01',WORKER_POLL_MS:'100',WORKER_ENROLLMENT_TOKEN:'',WORKER_DATA_DIR:path.join(dir,'worker')},stdio:'ignore'});
 const restartJob=await req('/api/compute/jobs',admin,{type:'echo',input:{restart:'credential-reuse'}});if(restartJob.status!==202)throw Error('restart test job submission failed');
 let restarted=false;for(let i=0;i<100;i++){const status=await req(`/api/compute/jobs/${restartJob.data.job.id}`,admin);if(status.data.job.status==='succeeded'){restarted=true;break}await wait(100)}if(!restarted)throw Error('worker could not restart from persisted credential without enrollment token');
 console.log('IZAKHONO Compute Manager + node lifecycle + one-time enrollment + restart E2E: PASS');
}finally{
 if(agent){agent.kill('SIGTERM');await new Promise(r=>agent.once('exit',r))}
 manager.kill('SIGTERM');await new Promise(r=>manager.once('exit',r));await rm(dir,{recursive:true,force:true})
}
