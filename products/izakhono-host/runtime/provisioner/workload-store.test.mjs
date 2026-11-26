import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorkloadStore } from './workload-store.mjs';

const spec = {
  workloadId: 'izakhono-nav',
  workloadClass: 'navigation-platform',
  logicalNodeId: 'NODE01',
  releaseDigest: 'b'.repeat(64),
  healthPath: '/health',
  internalPort: 8080,
  idempotencyKey: 'nav-registry-test-0001'
};

test('persists workload records and safely replays idempotent requests', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'host-workloads-'));
  const filePath = path.join(root, 'workloads.json');
  try {
    const firstStore = createWorkloadStore({ filePath });
    const first = await firstStore.create(spec, { now: '2026-11-21T00:00:00.000Z' });
    assert.equal(first.created, true);
    assert.equal(first.workload.logical_node_id, 'NODE01');
    assert.equal(first.workload.runtime_target_id, null);

    const secondStore = createWorkloadStore({ filePath });
    const replay = await secondStore.create(spec);
    assert.equal(replay.created, false);
    assert.equal(replay.workload.id, first.workload.id);
    assert.equal((await secondStore.get(first.workload.id)).state, 'REQUESTED');
    assert.equal((await secondStore.list()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects idempotency-key reuse for a different immutable release', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'host-workloads-'));
  try {
    const store = createWorkloadStore({ filePath: path.join(root, 'workloads.json') });
    await store.create(spec);
    await assert.rejects(
      store.create({ ...spec, releaseDigest: 'c'.repeat(64) }),
      error => error.code === 'IDEMPOTENCY_CONFLICT'
    );
    await assert.rejects(
      store.create({ ...spec, internalPort: 8081 }),
      error => error.code === 'IDEMPOTENCY_CONFLICT'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('serializes concurrent creates so one idempotency key creates one record', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'host-workloads-'));
  try {
    const store = createWorkloadStore({ filePath: path.join(root, 'workloads.json') });
    const results = await Promise.all([store.create(spec), store.create(spec), store.create(spec)]);
    assert.equal(results.filter(result => result.created).length, 1);
    assert.equal((await store.list()).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('stale workload lease tokens cannot write after a later worker reclaims the record', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'host-workload-lease-'));
  try {
    const store = createWorkloadStore({ filePath: path.join(root, 'workloads.json') });
    const { workload } = await store.create({ ...spec, runtimeTargetId: 'nav-target-a' });
    const first = await store.claimNext({ workerId: 'host-worker-a', leaseMs: 1000, now: new Date('2026-11-21T00:00:00.000Z') });
    const second = await store.claimNext({ workerId: 'host-worker-b', leaseMs: 1000, now: new Date('2026-11-21T00:00:02.000Z') });
    assert.notEqual(first.worker_lease.lease_id, second.worker_lease.lease_id);
    await assert.rejects(
      store.recordExecution(workload.id, 'host-worker-a', 'STALE_WRITE', {}, '2026-11-21T00:00:02.000Z', first.worker_lease.lease_id),
      /lease is missing, expired or owned by another worker/
    );
    await assert.rejects(
      store.releaseClaim(workload.id, 'host-worker-a', {}, '2026-11-21T00:00:02.000Z', first.worker_lease.lease_id),
      /superseded/
    );
    await store.recordExecution(workload.id, 'host-worker-b', 'CURRENT_WRITE', {}, '2026-11-21T00:00:02.000Z', second.worker_lease.lease_id);
    await store.releaseClaim(workload.id, 'host-worker-b', {}, '2026-11-21T00:00:02.000Z', second.worker_lease.lease_id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
