import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANGE_CLASSES,
  createObservation,
  detectOpportunity,
  proposeImprovement,
  evaluateChangeSafety,
  advanceImprovement,
  rankOpportunities,
  buildImprovementCycle
} from '../src/self-improvement-engine.js';

test('observation captures measurable evidence', () => {
  const item = createObservation({ metric: 'checkout_success_rate', value: 94.2, unit: 'percent', source: 'sandbox' });
  assert.equal(item.metric, 'checkout_success_rate');
  assert.equal(item.value, 94.2);
});

test('opportunity detection respects threshold', () => {
  const result = detectOpportunity([{ metric: 'conversion' }], { baseline: 80, current: 86, minimum_improvement_percent: 5 });
  assert.equal(result.detected, true);
});

test('proposal requires evidence and rollback before sandbox', () => {
  const proposal = proposeImprovement({ title: 'Improve checkout', evidence_ids: ['obs_1'], rollback_plan: 'restore previous route' });
  assert.equal(evaluateChangeSafety(proposal).safe_for_sandbox, true);
});

test('regulated live-money changes cannot bypass gate', () => {
  const proposal = proposeImprovement({
    title: 'Change live settlement routing',
    change_class: CHANGE_CLASSES.REGULATED_LIVE_MONEY,
    evidence_ids: ['obs_1'],
    rollback_plan: 'restore previous route'
  });
  assert.throws(() => advanceImprovement(proposal, 'release', { release_approved: true, live_gate_decision: 'NO_GO' }), /live_gate_go_required/);
});

test('ranking prioritizes impact and confidence while subtracting risk', () => {
  const ranked = rankOpportunities([
    { id: 'a', expected_impact_score: 5, confidence: 0.5, risk_score: 1 },
    { id: 'b', expected_impact_score: 8, confidence: 0.9, risk_score: 1 }
  ]);
  assert.equal(ranked[0].id, 'b');
});

test('cycle explicitly remains externally gated for live authorization', () => {
  const cycle = buildImprovementCycle({ observations: [{}], opportunities: [{}] });
  assert.equal(cycle.live_authorization, 'external_gate_required');
  assert.equal(cycle.release, null);
});
