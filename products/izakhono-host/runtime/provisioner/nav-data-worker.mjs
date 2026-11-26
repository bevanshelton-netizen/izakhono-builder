import { NAV_DATA_PIPELINE_STAGES, assertNavDataReady } from './nav-data-pipeline.mjs';

const METHODS = Object.freeze({
  'osm-source': 'fetchSource',
  'routing-graph': 'buildRoutingGraph',
  'search-index': 'importSearchIndex',
  'map-tiles': 'buildMapTiles',
  'service-acceptance': 'inspectServices'
});

const MAX_PASS_MS = 120000;

export function createNavDataWorker({ store, adapter, workerId = 'host-nav-data-worker', leaseMs = 180000, now = () => new Date() }) {
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
          if (job.pipeline.stages[stage.id].status === 'succeeded') continue;
          signal.throwIfAborted();
          const evidence = await adapter[METHODS[stage.id]]({
            workloadId: job.pipeline.workloadId,
            releaseDigest: job.pipeline.releaseDigest,
            priorEvidence: job.pipeline.stages,
            signal
          });
          signal.throwIfAborted();
          const updated = await store.recordStage(job.id, workerId, stage.id, evidence, now().toISOString());
          if (!updated) throw new Error('NAV data job disappeared while recording stage evidence');
          job.pipeline = updated.pipeline;
        }
        assertNavDataReady(job.pipeline);
        await store.release(job.id, workerId);
        return { processed: true, jobId: job.id, state: job.pipeline.state, dataReady: true };
      } catch (error) {
        const delay = [1000, 5000, 30000, 120000, 600000][Math.max(0, job.attempts - 1)];
        const retryAfter = new Date(now().getTime() + delay).toISOString();
        await store.release(job.id, workerId, {
          retryAfter,
          error: String(error?.message || 'NAV data import failed')
        });
        return {
          processed: true,
          jobId: job.id,
          retryAfter,
          error: String(error?.message || 'NAV data import failed').slice(0, 240)
        };
      }
    }
  });
}
