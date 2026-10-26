import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedulerCycle, deterministicCycleId, schedulerHealth } from '../src/autonomous-optimization-scheduler.js';

test('cycle identity is deterministic', () => {
  assert.equal(deterministicCycleId({ cycle_key: '2026-10-26T12:00Z', scope: 'platform' }), 'opt_platform_2026-10-26T12_00Z');
});

test('scheduler requires a cycle key', () => {
  assert.throws(() => buildSchedulerCycle({}), /cycle_key_required/);
});

test('scheduler creates only qualifying sandbox experiments', () => {
  const cycle = buildSchedulerCycle({ cycle_key: 'cycle-1', candidates: [
    { id: 'high', title: 'Improve success', metric: 'success', expected_impact_score: 90, confidence: 90, evidence_ids: ['e1'], rollback_plan: 'restore' },
    { id: 'low', title: 'Tiny change', metric: 'conversion', expected_impact_score: 20, confidence: 40, evidence_ids: ['e2'], rollback_plan: 'restore' }
  ]});
  assert.equal(cycle.experiments.length, 1);
  assert.equal(cycle.experiments[0].candidate_id, 'high');
  assert.equal(cycle.policy.live_money_movement, false);
  assert.equal(cycle.policy.authorization_mode, 'sandbox_only');
});

test('rollback learning feedback excludes a candidate from the next cycle', () => {
  const cycle = buildSchedulerCycle({
    cycle_key: 'cycle-learning-rollback',
    candidates: [
      { id: 'bad', title: 'Bad experiment', metric: 'success', expected_impact_score: 100, confidence: 95, evidence_ids: ['e1'], rollback_plan: 'restore' },
      { id: 'good', title: 'Good experiment', metric: 'success', expected_impact_score: 80, confidence: 90, evidence_ids: ['e2'], rollback_plan: 'restore' }
    ],
    learning_outcomes: [{ candidate_id: 'bad', decision: 'ROLLBACK', outcome: 'rollback' }]
  });
  assert.deepEqual(cycle.experiments.map((experiment) => experiment.candidate_id), ['good']);
  assert.equal(cycle.learning_feedback_applied, true);
});

test('promote-to-review learning feedback prioritizes a candidate', () => {
  const cycle = buildSchedulerCycle({
    cycle_key: 'cycle-learning-promote',
    candidates: [
      { id: 'normal', title: 'Normal experiment', metric: 'success', expected_impact_score: 100, confidence: 95, evidence_ids: ['e1'], rollback_plan: 'restore' },
      { id: 'promoted', title: 'Promoted experiment', metric: 'success', expected_impact_score: 80, confidence: 90, evidence_ids: ['e2'], rollback_plan: 'restore' }
    ],
    learning_outcomes: [{ candidate_id: 'promoted', decision: 'PROMOTE_TO_REVIEW', outcome: 'promote_to_review' }]
  });
  assert.equal(cycle.experiments[0].candidate_id, 'promoted');
});

test('continue-sandbox learning feedback leaves a candidate eligible', () => {
  const cycle = buildSchedulerCycle({
    cycle_key: 'cycle-learning-continue',
    candidates: [
      { id: 'continue', title: 'Continue experiment', metric: 'success', expected_impact_score: 80, confidence: 90, evidence_ids: ['e1'], rollback_plan: 'restore' }
    ],
    learning_outcomes: [{ candidate_id: 'continue', decision: 'CONTINUE_SANDBOX', outcome: 'continue_sandbox' }]
  });
  assert.equal(cycle.experiments.length, 1);
  assert.equal(cycle.experiments[0].candidate_id, 'continue');
});

test('scheduler caps experiment count and remains externally gated', () => {
  const candidates = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, title: `Candidate ${i}`, metric: 'success', expected_impact_score: 90 - i, confidence: 90, evidence_ids: [`e${i}`], rollback_plan: 'restore' }));
  const cycle = buildSchedulerCycle({ cycle_key: 'cycle-2', candidates });
  assert.equal(cycle.experiments.length, 3);
  assert.equal(cycle.policy.regulated_live_authorization, 'external_gate_required');
});

test('health report never reports live money movement', () => {
  const health = schedulerHealth({ cycle_id: 'x', status: 'sandbox_ready', experiments: [{}], rejected: [], learning_feedback_applied: true });
  assert.equal(health.live_money_movement, false);
  assert.equal(health.authorization_mode, 'sandbox_only');
  assert.equal(health.learning_feedback_applied, true);
});
