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
