import { workloadRetryDelay } from './workload-state-machine.mjs';

// One bounded execution pass. Provider selection is injected by trusted HOST
// configuration; no request body can select code, credentials or provider APIs.
export function createWorkloadWorker({ store, adapterRegistry, resolveBinding, navDataJobStore = null, workerId = 'host-nav-worker', leaseMs = 180000, now = () => new Date() }) {
  if (!store || typeof store.claimNext !== 'function' || typeof store.recordExecution !== 'function' || typeof store.releaseClaim !== 'function') {
    throw new Error('A lease-capable durable workload store is required');
  }
  if (!adapterRegistry || typeof adapterRegistry.get !== 'function') throw new Error('A trusted runtime adapter registry is required');
  if (typeof resolveBinding !== 'function') throw new Error('A trusted runtime binding resolver is required');
  if (navDataJobStore && typeof navDataJobStore.create !== 'function') throw new Error('A durable NAV data-job store is required when automatic data enqueue is enabled');

  return Object.freeze({
    async runOnce() {
      const claimed = await store.claimNext({ workerId, leaseMs, now: now() });
      if (!claimed) return { processed: false, reason: 'no-runnable-bound-workload' };

      try {
        // A single deadline covers target resolution, provisioning, deployment
        // and post-deployment inspection. Never drop cancellation at a boundary.
        const signal = AbortSignal.timeout(120000);
        const binding = await resolveBinding(claimed, { signal });
        if (!binding || typeof binding.adapterId !== 'string' || binding.runtimeTargetId !== claimed.runtime_target_id) {
          throw new Error('No approved adapter binding matches this HOST runtime target');
        }
        const adapter = adapterRegistry.get(binding.adapterId);
        if (!adapter) throw new Error('Approved runtime adapter is not registered');

        const leaseId = claimed.worker_lease.lease_id;
        const workload = claimed;
        const target = await adapter.resolveTarget({ runtimeTargetId: claimed.runtime_target_id, workload, signal });
        if (!target) throw new Error('Runtime adapter could not resolve the approved target');

        let current = await store.get(claimed.id);
        if (current?.state === 'REQUESTED') {
          await store.transition(claimed.id, 'VALIDATING', { workerId, adapterId: binding.adapterId });
          current = await store.get(claimed.id);
        }
        if (current?.state === 'VALIDATING') {
          await store.transition(claimed.id, 'PROVISIONING', { workerId, adapterId: binding.adapterId });
        }

        const resource = await adapter.provision({ target, workload, signal });
        await store.recordExecution(claimed.id, workerId, 'RUNTIME_PROVISIONED', {
          adapterId: binding.adapterId,
          runtimeTargetId: claimed.runtime_target_id,
          resourceId: typeof resource?.id === 'string' ? resource.id : null
        }, now().toISOString(), leaseId);

        await adapter.deploy({ target, resource, releaseDigest: claimed.release_digest, workload, signal });
        await store.recordExecution(claimed.id, workerId, 'RELEASE_DEPLOYED', {
          adapterId: binding.adapterId,
          releaseDigest: claimed.release_digest
        }, now().toISOString(), leaseId);

        const observation = await adapter.inspect({ target, resource, workload, signal });
        if (observation?.healthy !== true || String(observation.releaseDigest || '').toLowerCase() !== claimed.release_digest) {
          throw new Error('Runtime inspection did not confirm healthy execution of the requested immutable release');
        }

        await store.recordExecution(claimed.id, workerId, 'RUNTIME_HEALTH_CONFIRMED', {
          adapterId: binding.adapterId,
          releaseDigest: claimed.release_digest,
          stage: 'runtime-deployed-awaiting-data-pipeline'
        }, now().toISOString(), leaseId);
        let stage = 'runtime-deployed-awaiting-data-pipeline';
        if (navDataJobStore) {
          const job = await navDataJobStore.create({
            workloadId: claimed.workload_id,
            workloadRecordId: claimed.id,
            releaseDigest: claimed.release_digest
          });
          const current = await store.get(claimed.id);
          if (current?.state === 'PROVISIONING') {
            await store.transition(claimed.id, 'IMPORTING_DATA', { dataJobId: job.job.id, automatic: true });
          }
          stage = 'data-import-queued';
        }
        await store.releaseClaim(claimed.id, workerId, {}, now().toISOString(), leaseId);
        return { processed: true, workloadId: claimed.id, stage };
      } catch (error) {
        const nextAttempt = (claimed.attempts || 0) + 1;
        const terminal = nextAttempt >= 5;
        const delay = workloadRetryDelay(nextAttempt);
        const retryAfter = terminal ? null : new Date(now().getTime() + delay).toISOString();
        if (terminal) {
          const current = await store.get(claimed.id);
          if (current && ['REQUESTED','VALIDATING','PROVISIONING'].includes(current.state)) {
            await store.transition(claimed.id, 'FAILED', { error: 'WORKLOAD_EXECUTION_RETRY_LIMIT_REACHED' }, now().toISOString());
          }
        }
        await store.releaseClaim(claimed.id, workerId, {
          retryAfter,
          errorCode: terminal ? 'WORKLOAD_EXECUTION_RETRY_LIMIT_REACHED' : 'WORKLOAD_EXECUTION_FAILED'
        }, now().toISOString(), claimed.worker_lease.lease_id);
        return { processed: true, workloadId: claimed.id, retryAfter, terminal, error: String(error?.message || 'Runtime execution failed').slice(0, 240) };
      }
    }
  });
}
