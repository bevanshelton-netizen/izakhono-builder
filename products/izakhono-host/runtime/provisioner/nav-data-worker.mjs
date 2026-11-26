import { NAV_DATA_PIPELINE_STAGES, assertNavDataReady } from './nav-data-pipeline.mjs';

const METHODS = Object.freeze({
  'osm-source': 'fetchSource',
  'routing-graph': 'buildRoutingGraph',
  'search-index': 'importSearchIndex',
  'map-tiles': 'buildMapTiles',
  'service-acceptance': 'inspectServices'
});

const MAX_PASS_MS = 120000;

export function createNavDataWorker({ store, adapter, workloadStore = null, workerId = 'host-nav-data-worker', leaseMs = 180000, now = () => new Date() }) {
  if (!store || typeof store.claimNext !== 'function' || typeof store.recordStage !== 'function' || typeof store.release !== 'function') {
    throw new Error('A durable NAV data-job store is required');
  }
  if (!adapter || Object.values(METHODS).some(method => typeof adapter[method] !== 'function')) {
    throw new Error('A trusted NAV data adapter with the complete import lifecycle is required');
  }
  if (!Number.isInteger(leaseMs) || leaseMs <= MAX_PASS_MS || leaseMs > 300000) {
    throw new Error('NAV data-job lease must exceed the bounded 120-second worker pass and be at most 300000ms');
  }

  return Object.freeze({
    async runOnce() {
      const job = await store.claimNext({ workerId, leaseMs, now: now() });
      if (!job) return { processed: false, reason: 'no-runnable-nav-data-job' };

      try {
        // One deadline for the entire import, not a fresh timeout per stage.
        // The durable lease outlives this bounded pass so a second worker cannot
        // concurrently mutate the same pipeline while this pass is active.
        const signal = AbortSignal.timeout(MAX_PASS_MS);
        for (const stage of NAV_DATA_PIPELINE_STAGES) {
          const currentStage = job.pipeline.stages[stage.id];
          if (currentStage.status === 'succeeded') continue;
          signal.throwIfAborted();
          let result;
          const input = {
            stageId: stage.id,
            operationId: currentStage.operationId || null,
            workloadId: job.pipeline.workloadId,
            releaseDigest: job.pipeline.releaseDigest,
            priorEvidence: job.pipeline.stages,
            signal
          };
          if (currentStage.status === 'running') {
            if (typeof adapter.pollStage !== 'function') throw new Error('NAV data adapter cannot resume a running stage');
            result = await adapter.pollStage(input);
          } else if (typeof adapter.startStage === 'function') {
            result = await adapter.startStage(input);
          } else {
            result = await adapter[METHODS[stage.id]](input);
          }
          signal.throwIfAborted();
          if (result?.status === 'running') {
            const updated = await store.recordOperation(job.id, workerId, job.lease.leaseId, stage.id, result.operationId, now().toISOString());
            if (!updated) throw new Error('NAV data job disappeared while recording operation state');
            job.pipeline = updated.pipeline;
            const retryAfter = new Date(now().getTime() + 10000).toISOString();
            await store.release(job.id, workerId, job.lease.leaseId, { retryAfter });
            return { processed: true, jobId: job.id, waiting: true, stage: stage.id, retryAfter };
          }
          if (result?.status === 'failed') throw new Error('NAV_DATA_STAGE_FAILED');
          const evidence = result?.status === 'succeeded' ? result.evidence : result;
          const updated = await store.recordStage(job.id, workerId, job.lease.leaseId, stage.id, evidence, now().toISOString());
          if (!updated) throw new Error('NAV data job disappeared while recording stage evidence');
          job.pipeline = updated.pipeline;
        }
        assertNavDataReady(job.pipeline);
        if (workloadStore) {
          let workload = await workloadStore.get(job.workloadRecordId);
          if (!workload) throw new Error('HOST workload record is missing for completed NAV data job');
          if (workload.state === 'IMPORTING_DATA') workload = await workloadStore.transition(workload.id, 'STARTING', { dataJobId: job.id });
          if (workload?.state === 'STARTING') workload = await workloadStore.transition(workload.id, 'VERIFYING', { dataJobId: job.id });
          if (workload?.state === 'VERIFYING') {
            const services = job.pipeline.stages['service-acceptance'].evidence.services;
            workload = await workloadStore.transition(workload.id, 'READY', { acceptance: {
              runtime: true, data: true,
              routing: services['nav-router']?.healthy === true,
              search: services['nav-search']?.healthy === true,
              tiles: services['nav-tiles']?.healthy === true,
              persistence: job.pipeline.stages['service-acceptance'].evidence.persistenceCheck === true
            }, dataJobId: job.id });
          }
          if (workload?.state !== 'READY') throw new Error('NAV data pipeline completed but HOST workload readiness transition did not complete');
        }
        const completed = await store.release(job.id, workerId, job.lease.leaseId, { completed: true });
        job.pipeline = completed.pipeline;
        return { processed: true, jobId: job.id, state: job.pipeline.state, dataReady: true };
      } catch (error) {
        const nextAttempt = (job.attempts || 0) + 1;
        const exhausted = nextAttempt >= 5;
        const delay = [1000, 5000, 30000, 120000, 600000][Math.max(0, nextAttempt - 1)];
        const retryAfter = exhausted ? null : new Date(now().getTime() + delay).toISOString();
        if (exhausted && workloadStore && job.workloadRecordId) {
          const workload = await workloadStore.get(job.workloadRecordId);
          if (workload && ['IMPORTING_DATA','PROVISIONING','STARTING','VERIFYING'].includes(workload.state)) {
            await workloadStore.transition(workload.id, 'FAILED', { error: 'NAV_DATA_PIPELINE_RETRY_LIMIT_REACHED', dataJobId: job.id });
          }
        }
        await store.release(job.id, workerId, job.lease.leaseId, {
          retryAfter,
          failedAt: exhausted ? now().toISOString() : null,
          error: String(error?.message || 'NAV data import failed')
        });
        return {
          processed: true,
          jobId: job.id,
          retryAfter,
          terminal: exhausted,
          error: String(error?.message || 'NAV data import failed').slice(0, 240)
        };
      }
    }
  });
}
