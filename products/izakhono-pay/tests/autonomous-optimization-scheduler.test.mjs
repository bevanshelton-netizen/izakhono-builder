import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedulerCycle, schedulerHealth } from '../src/autonomous-optimization-scheduler.js';

test('scheduler creates only qualifying sandbox experiments', () => {
  const cycle = buildSchedulerCycle({
    metrics: [{ name: 'success', value: 96 }],
    current: { success: 96 },
    baseline: { success: 100 },
    candidates: [
      { id: 'high', title: 'Improve success', metric: 'success', expected_impact_score: 90, confidence: 90, evidence_ids: ['e1'], rollback_plan: 'restore' },
      { id: 'low', title: 'Tiny change', metric: 'conversion', expected_impact_score: 20, confidence: 40, evidence_ids: ['e2'], rollback_plan: 'restore' }
    ]
  });
  assert.equal(cycle.experiments.length, 1);
  assert.equal(cycle.experiments[0].candidate_id, 'high');
  assert.equal(cycle.policy.live_money_movement, false);
  assert.equal(cycle.policy.authorization_mode, 'sandbox_only');
});

test('scheduler caps experiment count and remains externally gated', () => {
  const candidates = Array.from({ length: 8 }, (_, i) => ({
    id: `c${i}`,
    title: `Candidate ${i}`,
    metric: 'success',
    expected_impact_score: 90 - i,
    confidence: 90,
    evidence_ids: [`e${i}`],
    rollback_plan: 'restore'
  }));
  const cycle = buildSchedulerCycle({ candidates });
  assert.equal(cycle.experiments.length, 3);
  assert.equal(cycle.policy.regulated_live_authorization, 'external_gate_required');
});

test('health report never reports live money movement', () => {
  const health = schedulerHealth({ cycle_id: 'x', status: 'sandbox_ready', experiments: [{}], rejected: [] });
  assert.equal(health.live_money_movement, false);
  assert.equal(health.authorization_mode, 'sandbox_only');
});
