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
      return serialize(async()=>{ const state=await read(); const existing=state.jobs.find(j=>j.pipeline.workloadId===workloadId&&j.workloadRecordId===workloadRecordId&&j.pipeline.releaseDigest===String(releaseDigest).toLowerCase()); if(existing)return {created:false,job:existing};
        if(typeof workloadRecordId!=='string'||!/^nav-workload-[a-f0-9]{20}$/.test(workloadRecordId))throw new Error('A valid HOST workload record ID is required');
        const job={id:`nav-data-${crypto.randomUUID().replaceAll('-','').slice(0,20)}`,workloadRecordId,attempts:0,leaseCount:0,retryAfter:null,lease:null,lastError:null,pipeline:createNavDataPipelineRecord({workloadId,releaseDigest,now})}; state.jobs.push(job); await write(state); return {created:true,job}; });
    },
    async list(){return (await read()).jobs;},
    async get(id){return (await read()).jobs.find(j=>j.id===id)||null;},
    async claimNext({workerId,leaseMs=180000,now=new Date()}={}) {
      return serialize(async()=>{ if(typeof workerId!=='string'||!/^[a-z0-9][a-z0-9-]{2,62}$/.test(workerId))throw new Error('workerId must be a stable lowercase identifier'); if(!Number.isInteger(leaseMs)||leaseMs<1000||leaseMs>300000)throw new Error('leaseMs must be between 1000 and 300000');
        const instant=now instanceof Date?now:new Date(now); if(!Number.isFinite(instant.getTime()))throw new Error('now must be a valid date'); const state=await read();
        const job=state.jobs.find(j=>['IMPORTING_DATA','VERIFYING'].includes(j.pipeline.state)&&j.attempts<5&&(!j.retryAfter||Date.parse(j.retryAfter)<=instant.getTime())&&(!j.lease||Date.parse(j.lease.expiresAt)<=instant.getTime()));
        if(!job)return null; job.leaseCount=(job.leaseCount||0)+1; job.retryAfter=null; job.lease={workerId,leaseId:crypto.randomUUID(),expiresAt:new Date(instant.getTime()+leaseMs).toISOString()}; await write(state); return job; });
    },
    async recordOperation(id,workerId,leaseId,stageId,operationId,now=new Date().toISOString()) {
      return serialize(async()=>{const state=await read();const job=state.jobs.find(j=>j.id===id);if(!job)return null;if(job.lease?.workerId!==workerId||job.lease?.leaseId!==leaseId||Date.parse(job.lease.expiresAt)<=Date.parse(now))throw new Error('NAV data-job lease is missing, expired or owned by another worker');if(!job.pipeline.stages[stageId])throw new Error('Unknown NAV data pipeline stage');if(typeof operationId!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(operationId))throw new Error('NAV data operation ID is invalid');const previous=job.pipeline.stages[stageId];job.pipeline={...job.pipeline,stages:{...job.pipeline.stages,[stageId]:{...previous,status:'running',operationId,startedAt:previous.startedAt||now,lastPolledAt:now}},updatedAt:now};await write(state);return job;});
    },
    async recordStage(id,workerId,leaseId,stageId,evidence,now=new Date().toISOString()) {
      return serialize(async()=>{const state=await read();const job=state.jobs.find(j=>j.id===id);if(!job)return null;if(job.lease?.workerId!==workerId||job.lease?.leaseId!==leaseId||Date.parse(job.lease.expiresAt)<=Date.parse(now))throw new Error('NAV data-job lease is missing, expired or owned by another worker');job.pipeline=recordNavDataStage(job.pipeline,stageId,evidence,now);await write(state);return job;});
    },
    async release(id,workerId,leaseId,{retryAfter=null,error=null,failedAt=null,completed=false}={}) {
      return serialize(async()=>{const state=await read();const job=state.jobs.find(j=>j.id===id);if(!job)return null;if(job.lease?.workerId!==workerId||job.lease?.leaseId!==leaseId)throw new Error('NAV data-job lease is owned by another worker or has been superseded');job.lease=null;job.lastError=error?String(error).slice(0,240):null;
        if(error){job.attempts=(job.attempts||0)+1;if(job.attempts>=5){job.pipeline={...job.pipeline,state:'FAILED',updatedAt:failedAt||new Date().toISOString(),failedAt:failedAt||new Date().toISOString()};job.retryAfter=null;}else job.retryAfter=retryAfter;}
        else if(completed){job.pipeline={...job.pipeline,state:'COMPLETED',updatedAt:new Date().toISOString(),completedAt:new Date().toISOString()};job.retryAfter=null;}
        else job.retryAfter=retryAfter;
        await write(state);return job;});
    }
  });
}
