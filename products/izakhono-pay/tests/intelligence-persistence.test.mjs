import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshotRecord, buildExperimentRecord, enforcePersistenceSafety } from '../src/intelligence-persistence.js';

test('snapshot records are forced to remain non-live', () => {
  const record = buildSnapshotRecord({
    snapshot_id: 'snap-1',
    health: { score: 91, status: 'excellent' },
    signals: [],
    candidates: [],
    control: { provider_neutral: true }
  });
  assert.equal(record.health_score, 91);
  assert.equal(record.control.live_money_movement, false);
  assert.equal(record.control.regulated_live_change, 'external_approval_required');
});

test('experiment records are sandbox-only', () => {
  const record = buildExperimentRecord(
    { id: 'exp-1', baseline: 95, target: 98, guardrails: ['failure <= 2%'], minimum_sample_size: 100, observation_window: '24h', rollback_criteria: ['guardrail_breach'] },
    { id: 'candidate-1', change_class: 'payment_routing' }
  );
  assert.equal(record.stage, 'sandbox');
  assert.equal(record.live_money_movement, false);
  assert.equal(record.authorization_mode, 'sandbox_only');
});

test('unsafe persistence attempts fail closed', () => {
  assert.throws(() => enforcePersistenceSafety({ live_money_movement: true }), /persistence_live_money_movement_forbidden/);
  assert.throws(() => enforcePersistenceSafety({ authorization_mode: 'live' }), /persistence_authorization_must_be_sandbox_only/);
});
