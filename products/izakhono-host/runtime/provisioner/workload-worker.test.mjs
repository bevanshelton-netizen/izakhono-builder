import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkloadStore } from './workload-store.mjs';
import { createRuntimeAdapterRegistry } from './runtime-adapter-contract.mjs';
import { createWorkloadWorker } from './workload-worker.mjs';
import { createNavDataJobStore } from './nav-data-job-store.mjs';

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
      async resolveTarget(input) { assert.ok(input.signal instanceof AbortSignal); calls.push('resolve'); return { id: input.runtimeTargetId }; },
      async provision(input) { assert.ok(input.signal instanceof AbortSignal); calls.push('provision'); return { id: 'opaque-resource-1' }; },
      async deploy(input) { assert.ok(input.signal instanceof AbortSignal); calls.push('deploy'); },
      async inspect(input) { assert.ok(input.signal instanceof AbortSignal); calls.push('inspect'); return { healthy: true, releaseDigest: spec.releaseDigest }; },
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
    let clock = new Date('2026-11-21T10:00:00.000Z');
    const worker = createWorkloadWorker({
      store, adapterRegistry: createRuntimeAdapterRegistry(),
      resolveBinding: async record => ({ adapterId: 'missing-adapter', runtimeTargetId: record.runtime_target_id }),
      now: () => clock
    });
    let result;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      result = await worker.runOnce();
      assert.equal(result.processed, true);
      assert.equal(result.terminal, attempt === 5);
      if (result.retryAfter) clock = new Date(Date.parse(result.retryAfter) + 1000);
    }
    assert.match(result.error, /not registered/);
    const saved = await store.get(workload.id);
    assert.equal(saved.state, 'FAILED');
    assert.equal(saved.last_execution_error, 'WORKLOAD_EXECUTION_RETRY_LIMIT_REACHED');
    assert.equal(saved.worker_lease, undefined);
    assert.equal(saved.retry_after, undefined);
    assert.equal((await worker.runOnce()).processed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('automatically queues the South Africa data pipeline after verified runtime deployment', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'host-worker-data-'));
  try {
    const store = createWorkloadStore({ filePath: path.join(root, 'workloads.json') });
    const navDataJobStore = createNavDataJobStore({ filePath: path.join(root, 'nav-data-jobs.json') });
    const { workload } = await store.create(spec);
    const registry = createRuntimeAdapterRegistry();
    registry.register('test-adapter', {
      async resolveTarget() { return { id: 'nav-target-a' }; },
      async provision() { return { id: 'runtime-resource-1' }; },
      async deploy() {},
      async inspect() { return { healthy: true, releaseDigest: spec.releaseDigest }; },
      async stop() {}, async destroy() {}, async backup() {}, async restore() {}
    });
    const worker = createWorkloadWorker({
      store, adapterRegistry: registry, navDataJobStore,
      resolveBinding: async record => ({ adapterId: 'test-adapter', runtimeTargetId: record.runtime_target_id }),
      now: () => new Date('2026-11-21T10:00:00.000Z')
    });
    const result = await worker.runOnce();
    assert.equal(result.stage, 'data-import-queued');
    const saved = await store.get(workload.id);
    assert.equal(saved.state, 'IMPORTING_DATA');
    assert.equal(saved.execution_stage, 'runtime-deployed-awaiting-data-pipeline');
    const jobs = await navDataJobStore.list();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].workloadRecordId, workload.id);
    assert.equal(jobs[0].pipeline.releaseDigest, spec.releaseDigest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
