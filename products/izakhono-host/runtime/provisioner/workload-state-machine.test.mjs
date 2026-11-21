import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkloadRecord, transitionWorkload, assertPublicActivation,
  recordWorkloadAttempt, workloadRetryDelay
} from './workload-state-machine.mjs';

const spec = {
  workloadId: 'izakhono-nav',
  workloadClass: 'navigation-platform',
  logicalNodeId: 'NODE01',
  releaseDigest: 'a'.repeat(64),
  healthPath: '/health',
  internalPort: 8080,
  idempotencyKey: 'nav-release-2026-11-21'
};
const readyEvidence = { runtime:true, data:true, routing:true, search:true, tiles:true, persistence:true };

test('creates a workload without binding it to a physical host', () => {
  const record = createWorkloadRecord(spec, { id:'nav-workload-001', now:'2026-11-21T00:00:00.000Z' });
  assert.equal(record.logical_node_id, 'NODE01');
  assert.equal(record.runtime_target_id, null);
  assert.equal(record.public_live, false);
  assert.equal(record.state, 'REQUESTED');
});

test('rejects mutable or invalid release identities', () => {
  assert.throws(() => createWorkloadRecord({ ...spec, releaseDigest:'latest' }, { id:'nav-workload-001' }), /SHA-256/);
  assert.throws(() => createWorkloadRecord({ ...spec, logicalNodeId:'server-01' }, { id:'nav-workload-001' }), /logical NODE/);
});

test('enforces lifecycle and requires service acceptance before READY', () => {
  let record = createWorkloadRecord(spec, { id:'nav-workload-001' });
  for (const state of ['VALIDATING','PROVISIONING','IMPORTING_DATA','STARTING','VERIFYING']) {
    record = transitionWorkload(record, state);
  }
  assert.throws(() => transitionWorkload(record, 'READY', { acceptance:{ runtime:true } }), /requires verified evidence/);
  record = transitionWorkload(record, 'READY', { acceptance:readyEvidence });
  assert.equal(record.state, 'READY');
});

test('blocks public activation until independent edge and restore evidence pass', () => {
  const record = { state:'READY', public_live:false, acceptance:readyEvidence, audit:[] };
  assert.throws(() => assertPublicActivation(record, readyEvidence), /backup_restore/);
  const live = assertPublicActivation(record, { ...readyEvidence, backup_restore:true, https:true, dns:true });
  assert.equal(live.public_live, true);
});

test('requires explicit owner approval for rollback', () => {
  const record = { state:'FAILED', audit:[] };
  assert.throws(() => transitionWorkload(record, 'ROLLING_BACK'), /owner approval/);
  assert.equal(transitionWorkload(record, 'ROLLING_BACK', { ownerApproved:true }).state, 'ROLLING_BACK');
});

test('bounds retries and applies capped backoff', () => {
  let record = { attempts:0, audit:[] };
  for (let i=0;i<5;i++) record = recordWorkloadAttempt(record);
  assert.throws(() => recordWorkloadAttempt(record), /retry limit/);
  assert.equal(workloadRetryDelay(1), 1000);
  assert.equal(workloadRetryDelay(99), 600000);
});
