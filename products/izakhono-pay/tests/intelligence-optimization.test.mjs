import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMetric,
  calculateHealthScore,
  detectSignals,
  createOptimizationCandidate,
  rankOptimizationCandidates,
  createExperiment,
  evaluateExperiment,
  buildOptimizationSnapshot
} from '../src/intelligence-optimization.js';
import { CHANGE_CLASSES } from '../src/self-improvement-engine.js';

test('normalizes metrics and calculates a health score', () => {
  const result = calculateHealthScore([
    normalizeMetric({ name: 'success', value: 96 }),
    normalizeMetric({ name: 'conversion', value: 84 })
  ]);
  assert.equal(result.score, 90);
  assert.equal(result.status, 'excellent');
});

test('detects material metric movement against baseline', () => {
  const signals = detectSignals({ success: 90, latency: 120 }, { success: 100, latency: 100 }, { threshold_percent: 5 });
  assert.equal(signals.length, 2);
  assert.equal(signals[0].name, 'success');
});

test('ranks optimization candidates by impact, confidence and risk', () => {
  const candidates = [
    createOptimizationCandidate({ id: 'a', title: 'A', metric: 'conversion', expected_impact_score: 80, confidence: 90, risk_score: 10 }),
    createOptimizationCandidate({ id: 'b', title: 'B', metric: 'latency', expected_impact_score: 70, confidence: 70, risk_score: 5 })
  ];
  const ranked = rankOptimizationCandidates(candidates);
  assert.equal(ranked[0].id, 'a');
  assert.equal(ranked[0].rank, 1);
});

test('experiments require evidence and rollback and remain sandbox-only', () => {
  const candidate = createOptimizationCandidate({
    id: 'routing-1',
    title: 'Improve route success',
    metric: 'payment_success_rate',
    change_class: CHANGE_CLASSES.PAYMENT_ROUTING,
    expected_impact_score: 90,
    confidence: 80,
    evidence_ids: ['obs-1'],
    rollback_plan: 'restore previous route weights',
    guardrails: ['failure_rate <= 2%']
  });
  const experiment = createExperiment(candidate, { minimum_sample_size: 100, target: 98 });
  const result = evaluateExperiment(experiment, { sample_size: 100, value: 99 });
  assert.equal(result.decision, 'PROMOTE_TO_REVIEW');
  assert.equal(result.live_money_movement, false);
  assert.equal(result.live_authorization, 'external_gate_required');
});

test('regulated live-money changes are never converted into automatic live authorization', () => {
  const candidate = createOptimizationCandidate({
    title: 'Change regulated settlement behavior',
    metric: 'settlement_success_rate',
    change_class: CHANGE_CLASSES.REGULATED_LIVE_MONEY,
    evidence_ids: ['e1'],
    rollback_plan: 'restore prior implementation'
  });
  const experiment = createExperiment(candidate);
  const result = evaluateExperiment(experiment, { sample_size: 100, value: 100 });
  assert.equal(result.live_money_movement, false);
  assert.equal(result.live_authorization, 'external_gate_required');
});

test('snapshot is privacy-filtered, provider-neutral and fail-closed for live money', () => {
  const candidate = createOptimizationCandidate({ title: 'Reduce latency', metric: 'latency', evidence_ids: ['e1'], rollback_plan: 'restore' });
  const snapshot = buildOptimizationSnapshot({
    metrics: [{ name: 'success', value: 95 }],
    current: { success: 95 },
    baseline: { success: 100 },
    candidates: [candidate]
  });
  assert.equal(snapshot.control.provider_neutral, true);
  assert.equal(snapshot.control.privacy_filtered, true);
  assert.equal(snapshot.control.live_money_movement, false);
  assert.equal(snapshot.control.regulated_live_change, 'external_approval_required');
});
