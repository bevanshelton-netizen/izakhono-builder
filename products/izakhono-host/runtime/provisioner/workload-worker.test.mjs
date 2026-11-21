import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkloadStore } from './workload-store.mjs';
import { createRuntimeAdapterRegistry } from './runtime-adapter-contract.mjs';
import { createWorkloadWorker } from './workload-worker.mjs';

const spec = {
  workloadId: 'izakhono-nav',
  workloadClass: 'navigation-platform',
  logicalNodeId: 'NODE01',
  runtimeTargetId: 'host-nav-approved-target',
  releaseDigest: 'f'.repeat(64),
  healthPath: '/health',
  internalPort: 8080,
  idempotencyKey: 'host-worker-test-release-001'
};

test('worker provisions only through a trusted adapter and stops before READY', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'host-worker-'));
  try {
    const store = createWorkloadStore({ filePath: path.join(root, 'workloads.json') });
    const { workload } = await store.create(spec);
    const registry = createRuntimeAdapterRegistry();
    const calls = [];
    registry.register('test-adapter', {
      async resolveTarget(input) { calls.push('resolve'); return { id: input.runtimeTargetId }; },
      async provision() { calls.push('provision'); return { id: 'opaque-resource-1' }; },
      async deploy() { calls.push('deploy'); },
      async inspect() { calls.push('inspect'); return { healthy: true, releaseDigest: spec.releaseDigest }; },
      async stop() {}, async destroy() {}, async backup() {}, async restore() {}
    });
    const worker = createWorkloadWorker({
      store, adapterRegistry: registry,
      resolveBinding: async record => ({ adapterId: 'test-adapter', runtimeTargetId: record.runtime_target_id }),
      now: () => new Date('2026-11-21T10:00:00.000Z')
    });
    const result = await worker.runOnce();
    assert.equal(result.processed, true);
    assert.equal(result.stage, 'runtime-deployed-awaiting-data-pipeline');
    assert.deepEqual(calls, ['resolve', 'provision', 'deploy', 'inspect']);
    const saved = await store.get(workload.id);
    assert.equal(saved.state, 'PROVISIONING');
    assert.equal(saved.public_live, false);
    assert.equal(saved.execution_stage, 'runtime-deployed-awaiting-data-pipeline');
    assert.equal(saved.execution_evidence.length, 3);
    assert.equal(saved.worker_lease, undefined);
    assert.equal((await worker.runOnce()).processed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('worker refuses an unregistered adapter and schedules a bounded retry', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'host-worker-'));
  try {
    const store = createWorkloadStore({ filePath: path.join(root, 'workloads.json') });
    const { workload } = await store.create(spec);
    const worker = createWorkloadWorker({
      store, adapterRegistry: createRuntimeAdapterRegistry(),
      resolveBinding: async record => ({ adapterId: 'missing-adapter', runtimeTargetId: record.runtime_target_id }),
      now: () => new Date('2026-11-21T10:00:00.000Z')
    });
    const result = await worker.runOnce();
    assert.equal(result.processed, true);
    assert.match(result.error, /not registered/);
    const saved = await store.get(workload.id);
    assert.equal(saved.state, 'REQUESTED');
    assert.equal(saved.last_execution_error, 'WORKLOAD_EXECUTION_FAILED');
    assert.equal(saved.worker_lease, undefined);
    assert.ok(saved.retry_after);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
