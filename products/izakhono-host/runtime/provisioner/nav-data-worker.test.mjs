import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createNavDataJobStore} from './nav-data-job-store.mjs';
import {createNavDataWorker} from './nav-data-worker.mjs';
import {createWorkloadStore} from './workload-store.mjs';
const digest='a'.repeat(64);
const evidence={
'osm-source':{sourceUrl:'https://download.geofabrik.de/africa/south-africa-latest.osm.pbf',artifactPath:'osm/sa.pbf',checksumAlgorithm:'md5',checksum:'b'.repeat(32),bytes:1024},
'routing-graph':{artifactPath:'router/graph',buildId:'valhalla-1',healthCheck:true},
'search-index':{artifactPath:'search/index',importId:'nominatim-1',healthCheck:true},
'map-tiles':{artifactPath:'tiles/sa.pmtiles',checksumAlgorithm:'sha256',checksum:'c'.repeat(64),tileCount:500},
'service-acceptance':{releaseDigest:digest,persistenceCheck:true,services:Object.fromEntries(['nav-router','nav-search','nav-tiles','nav-engine','nav-web'].map(n=>[n,{healthy:true}]))}};
const methods={'osm-source':'fetchSource','routing-graph':'buildRoutingGraph','search-index':'importSearchIndex','map-tiles':'buildMapTiles','service-acceptance':'inspectServices'};
test('durably executes South Africa data stages through trusted adapter',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'nav-data-jobs-'));try{
 const store=createNavDataJobStore({filePath:path.join(root,'jobs.json')});const created=await store.create({workloadId:'izakhono-nav',workloadRecordId:'nav-workload-0123456789abcdefabcd',releaseDigest:digest});assert.equal(created.created,true);
 const calls=[];const signals=[];const adapter=Object.fromEntries(Object.entries(methods).map(([s,m])=>[m,async({signal})=>{assert.ok(signal instanceof AbortSignal);signals.push(signal);calls.push(s);return evidence[s];}]));
 const worker=createNavDataWorker({store,adapter,now:()=>new Date('2026-11-21T12:00:00.000Z')});const result=await worker.runOnce();assert.equal(result.dataReady,true);assert.equal(result.state,'VERIFYING');assert.deepEqual(calls,Object.keys(methods));assert.equal(new Set(signals).size,1,'all stages share one bounded cancellation signal');
 const saved=await store.get(created.job.id);assert.equal(saved.pipeline.state,'VERIFYING');assert.equal(saved.lease,null);assert.equal(saved.pipeline.stages['osm-source'].evidence.checksum,'b'.repeat(32));
 assert.equal((await store.create({workloadId:'izakhono-nav',workloadRecordId:'nav-workload-0123456789abcdefabcd',releaseDigest:digest})).created,false);
}finally{await rm(root,{recursive:true,force:true});}});
test('requires complete trusted adapter and retries failures without readiness',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'nav-data-jobs-'));try{
 const store=createNavDataJobStore({filePath:path.join(root,'jobs.json')});const {job}=await store.create({workloadId:'izakhono-nav',workloadRecordId:'nav-workload-0123456789abcdefabcd',releaseDigest:digest});
 assert.throws(()=>createNavDataWorker({store,adapter:{}}),/complete import lifecycle/);
 const adapter=Object.fromEntries(Object.values(methods).map(m=>[m,async()=>{throw new Error('source unavailable');}]));
 const worker=createNavDataWorker({store,adapter,now:()=>new Date('2026-11-21T12:00:00.000Z')});const result=await worker.runOnce();assert.match(result.error,/source unavailable/);
 const saved=await store.get(job.id);assert.equal(saved.pipeline.state,'IMPORTING_DATA');assert.equal(saved.pipeline.stages['osm-source'].status,'pending');assert.equal(saved.lease,null);assert.ok(saved.retryAfter);
}finally{await rm(root,{recursive:true,force:true});}});
test('resumes completed stages after a later stage fails',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'nav-data-jobs-'));try{
 const store=createNavDataJobStore({filePath:path.join(root,'jobs.json')});const {job}=await store.create({workloadId:'izakhono-nav',workloadRecordId:'nav-workload-0123456789abcdefabcd',releaseDigest:digest});let fail=true;
 const adapter=Object.fromEntries(Object.entries(methods).map(([s,m])=>[m,async()=>{if(s==='search-index'&&fail)throw new Error('search import interrupted');return evidence[s];}]));
 let clock=new Date('2026-11-21T12:00:00.000Z');const worker=createNavDataWorker({store,adapter,now:()=>clock});const first=await worker.runOnce();assert.match(first.error,/search import interrupted/);
 let saved=await store.get(job.id);assert.equal(saved.pipeline.stages['osm-source'].status,'succeeded');fail=false;clock=new Date(Date.parse(first.retryAfter)+1000);
 const second=await worker.runOnce();assert.equal(second.dataReady,true);saved=await store.get(job.id);assert.equal(saved.pipeline.state,'VERIFYING');
}finally{await rm(root,{recursive:true,force:true});}});

test('marks a NAV data job failed after the fifth bounded attempt',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'nav-data-jobs-'));try{
 const store=createNavDataJobStore({filePath:path.join(root,'jobs.json')});const {job}=await store.create({workloadId:'izakhono-nav',workloadRecordId:'nav-workload-0123456789abcdefabcd',releaseDigest:digest});
 const adapter=Object.fromEntries(Object.values(methods).map(m=>[m,async()=>{throw new Error('persistent import failure');}]));
 let clock=new Date('2026-11-21T12:00:00.000Z');const worker=createNavDataWorker({store,adapter,now:()=>clock});
 let result;
 for(let attempt=1;attempt<=5;attempt+=1){result=await worker.runOnce();assert.equal(result.terminal,attempt===5);if(result.retryAfter)clock=new Date(Date.parse(result.retryAfter)+1000);}
 const saved=await store.get(job.id);assert.equal(saved.pipeline.state,'FAILED');assert.equal(saved.lease,null);assert.equal(saved.retryAfter,null);assert.equal(saved.attempts,5);
 assert.equal((await worker.runOnce()).processed,false);
}finally{await rm(root,{recursive:true,force:true});}});

test('promotes the same HOST workload to READY only after full data and persistence acceptance',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'nav-data-ready-'));try{
 const workloadStore=createWorkloadStore({filePath:path.join(root,'workloads.json')});
 const {workload}=await workloadStore.create({workloadId:'izakhono-nav',workloadClass:'navigation-platform',logicalNodeId:'NODE01',runtimeTargetId:'nav-target-a',releaseDigest:digest,healthPath:'/health',internalPort:8080,idempotencyKey:'nav-data-ready-test-001'});
 await workloadStore.transition(workload.id,'VALIDATING');
 await workloadStore.transition(workload.id,'PROVISIONING');
 await workloadStore.transition(workload.id,'IMPORTING_DATA');
 const store=createNavDataJobStore({filePath:path.join(root,'jobs.json')});
 const {job}=await store.create({workloadId:'izakhono-nav',workloadRecordId:workload.id,releaseDigest:digest});
 const adapter=Object.fromEntries(Object.entries(methods).map(([stage,method])=>[method,async()=>evidence[stage]]));
 const worker=createNavDataWorker({store,adapter,workloadStore,now:()=>new Date('2026-11-21T12:00:00.000Z')});
 const result=await worker.runOnce();assert.equal(result.dataReady,true);
 const ready=await workloadStore.get(workload.id);assert.equal(ready.state,'READY');assert.equal(ready.public_live,false);
 assert.deepEqual(ready.acceptance,{runtime:true,data:true,routing:true,search:true,tiles:true,persistence:true,backup_restore:false,https:false,dns:false});
}finally{await rm(root,{recursive:true,force:true});}});
