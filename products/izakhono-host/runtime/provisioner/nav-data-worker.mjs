import { NAV_DATA_PIPELINE_STAGES, assertNavDataReady } from './nav-data-pipeline.mjs';
const METHODS=Object.freeze({'osm-source':'fetchSource','routing-graph':'buildRoutingGraph','search-index':'importSearchIndex','map-tiles':'buildMapTiles','service-acceptance':'inspectServices'});
export function createNavDataWorker({store,adapter,workerId='host-nav-data-worker',leaseMs=180000,now=()=>new Date()}){
  if(!store||typeof store.claimNext!=='function'||typeof store.recordStage!=='function'||typeof store.release!=='function')throw new Error('A durable NAV data-job store is required');
  if(!adapter||Object.values(METHODS).some(m=>typeof adapter[m]!=='function'))throw new Error('A trusted NAV data adapter with the complete import lifecycle is required');
  return Object.freeze({async runOnce(){
    const job=await store.claimNext({workerId,leaseMs,now:now()});if(!job)return {processed:false,reason:'no-runnable-nav-data-job'};
    try{
      for(const stage of NAV_DATA_PIPELINE_STAGES){if(job.pipeline.stages[stage.id].status==='succeeded')continue;
        const evidence=await adapter[METHODS[stage.id]]({workloadId:job.pipeline.workloadId,releaseDigest:job.pipeline.releaseDigest,priorEvidence:job.pipeline.stages,signal:AbortSignal.timeout(120000)});
        const updated=await store.recordStage(job.id,workerId,stage.id,evidence,now().toISOString());job.pipeline=updated.pipeline;
      }
      assertNavDataReady(job.pipeline);await store.release(job.id,workerId);return {processed:true,jobId:job.id,state:job.pipeline.state,dataReady:true};
    }catch(error){const delay=[1000,5000,30000,120000,600000][Math.max(0,job.attempts-1)];const retryAfter=new Date(now().getTime()+delay).toISOString();await store.release(job.id,workerId,{retryAfter,error:String(error?.message||'NAV data import failed')});return {processed:true,jobId:job.id,retryAfter,error:String(error?.message||'NAV data import failed').slice(0,240)};}
  }});
}
