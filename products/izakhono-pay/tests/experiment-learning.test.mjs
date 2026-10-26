import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSandboxExperiment, evaluateLearningCycle } from '../src/experiment-learning.js';

test('guardrail breach rolls back and never enables live money', () => {
  const outcome = evaluateSandboxExperiment({ id: 'exp-1', candidate_id: 'c-1', minimum_sample_size: 10 }, { sample_size: 10, guardrails_breached: ['success_rate'] });
  assert.equal(outcome.decision, 'ROLLBACK');
  assert.equal(outcome.live_money_movement, false);
  assert.equal(outcome.authorization_mode, 'sandbox_only');
});

test('sufficient sample and target promotes only to external review', () => {
  const outcome = evaluateSandboxExperiment({ id: 'exp-2', candidate_id: 'c-2', minimum_sample_size: 10, target: 95 }, { sample_size: 10, value: 97, guardrails_breached: [] });
  assert.equal(outcome.decision, 'PROMOTE_TO_REVIEW');
  assert.equal(outcome.learning_feedback.next_cycle_action, 'require_external_review');
  assert.equal(outcome.live_money_movement, false);
});

test('learning cycle persists sandbox outcomes', async () => {
  const writes = [];
  const result = await evaluateLearningCycle({
    experiments: [{ id: 'exp-3', candidate_id: 'c-3', minimum_sample_size: 10, target: 95 }],
    observations: { 'exp-3': { sample_size: 5, value: 90, guardrails_breached: [] } },
    persistence: { insertOutcome: async (row) => { writes.push(row); return { id: 'out-1' }; } }
  });
  assert.equal(result.evaluated, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].authorization_mode, 'sandbox_only');
  assert.equal(writes[0].live_money_movement, false);
});
