import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createNavDataPipelineRecord, recordNavDataStage } from './nav-data-pipeline.mjs';
export function createNavDataJobStore({ filePath }) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('A persistent NAV data-job filePath is required');
  let queue = Promise.resolve();
  async function read() {
    try { const value=JSON.parse(await fs.readFile(filePath,'utf8')); if(value?.version!==1||!Array.isArray(value.jobs)) throw new Error('Unsupported NAV data-job store format'); return value; }
    catch(error) { if(error?.code!=='ENOENT') throw error; return {version:1,jobs:[]}; }
  }
  async function write(value) {
    await fs.mkdir(path.dirname(filePath),{recursive:true});
    const temp=`${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try { await fs.writeFile(temp,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'}); await fs.rename(temp,filePath); }
    catch(error) { await fs.rm(temp,{force:true}).catch(()=>{}); throw error; }
  }
  function serialize(fn) { const result=queue.then(fn,fn); queue=result.then(()=>undefined,()=>undefined); return result; }
  return Object.freeze({
    async create({workloadId,workloadRecordId,releaseDigest,now=new Date().toISOString()}) {
      return serialize(async()=>{ const state=await read(); const existing=state.jobs.find(j=>j.pipeline.workloadId===workloadId&&j.pipeline.releaseDigest===String(releaseDigest).toLowerCase()); if(existing)return {created:false,job:existing};
        if(typeof workloadRecordId!=='string'||!/^nav-workload-[a-f0-9]{20}$/.test(workloadRecordId))throw new Error('A valid HOST workload record ID is required');
        const job={id:`nav-data-${crypto.randomUUID().replaceAll('-','').slice(0,20)}`,workloadRecordId,attempts:0,retryAfter:null,lease:null,lastError:null,pipeline:createNavDataPipelineRecord({workloadId,releaseDigest,now})}; state.jobs.push(job); await write(state); return {created:true,job}; });
    },
    async list(){return (await read()).jobs;},
    async get(id){return (await read()).jobs.find(j=>j.id===id)||null;},
    async claimNext({workerId,leaseMs=180000,now=new Date()}={}) {
      return serialize(async()=>{ if(typeof workerId!=='string'||!/^[a-z0-9][a-z0-9-]{2,62}$/.test(workerId))throw new Error('workerId must be a stable lowercase identifier'); if(!Number.isInteger(leaseMs)||leaseMs<1000||leaseMs>300000)throw new Error('leaseMs must be between 1000 and 300000');
        const instant=now instanceof Date?now:new Date(now); if(!Number.isFinite(instant.getTime()))throw new Error('now must be a valid date'); const state=await read();
        const job=state.jobs.find(j=>j.pipeline.state==='IMPORTING_DATA'&&j.attempts<5&&(!j.retryAfter||Date.parse(j.retryAfter)<=instant.getTime())&&(!j.lease||Date.parse(j.lease.expiresAt)<=instant.getTime()));
        if(!job)return null; job.attempts++; job.retryAfter=null; job.lease={workerId,expiresAt:new Date(instant.getTime()+leaseMs).toISOString()}; await write(state); return job; });
    },
    async recordStage(id,workerId,stageId,evidence,now=new Date().toISOString()) {
      return serialize(async()=>{const state=await read();const job=state.jobs.find(j=>j.id===id);if(!job)return null;if(job.lease?.workerId!==workerId||Date.parse(job.lease.expiresAt)<=Date.parse(now))throw new Error('NAV data-job lease is missing, expired or owned by another worker');job.pipeline=recordNavDataStage(job.pipeline,stageId,evidence,now);await write(state);return job;});
    },
    async release(id,workerId,{retryAfter=null,error=null,failedAt=null}={}) {
      return serialize(async()=>{const state=await read();const job=state.jobs.find(j=>j.id===id);if(!job)return null;if(job.lease?.workerId!==workerId)throw new Error('NAV data-job lease is owned by another worker');job.lease=null;job.lastError=error?String(error).slice(0,240):null;
        if(error&&job.attempts>=5){job.pipeline={...job.pipeline,state:'FAILED',updatedAt:failedAt||new Date().toISOString(),failedAt:failedAt||new Date().toISOString()};job.retryAfter=null;}
        else job.retryAfter=retryAfter;
        await write(state);return job;});
    }
  });
}
