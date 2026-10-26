import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseMetrics,
  detectSignals,
  proposeImprovement,
  evaluateExperiment,
  releaseDecision,
  canSelfDeploy
} from '../src/self-improvement.js';

test('metrics are normalised safely', () => {
  const result = normaliseMetrics({ transactions: 100, succeeded: 96, failed: 3, pending: 1 });
  assert.equal(result.success_rate, 0.96);
  assert.equal(result.failure_rate, 0.03);
});

test('engine detects meaningful operational signals', () => {
  const result = detectSignals({ transactions: 100, succeeded: 90, failed: 8, pending: 2, fraud: 0, incidents: 1 });
  assert.ok(result.signals.some((x) => x.code === 'LOW_SUCCESS_RATE'));
  assert.ok(result.signals.some((x) => x.code === 'OPERATIONAL_INCIDENTS'));
});

test('protected payment domains require human approval', () => {
  const proposal = proposeImprovement({ code:'LOW_SUCCESS_RATE', severity:'high' }, { domain:'live_provider_activation' });
  assert.equal(proposal.requires_human_approval, true);
  assert.equal(proposal.allowed_next_stage, 'proposed');
});

test('safe improvements can enter sandbox after detection', () => {
  const proposal = proposeImprovement({ code:'HIGH_PENDING_RATE', severity:'medium' }, { domain:'payment_operations', riskScore:1 });
  assert.equal(proposal.requires_human_approval, false);
  assert.equal(proposal.allowed_next_stage, 'sandbox');
});

test('experiment requires enough sample and minimum lift', () => {
  assert.equal(evaluateExperiment({ baseline:0.90, candidate:0.92, minimumLift:0.01, sampleSize:50 }).pass, true);
  assert.equal(evaluateExperiment({ baseline:0.90, candidate:0.905, minimumLift:0.01, sampleSize:50 }).pass, false);
});

test('release decision blocks failed security', () => {
  const proposal = proposeImprovement({ code:'HIGH_PENDING_RATE', severity:'medium' }, { domain:'payment_operations', riskScore:1 });
  const experiment = evaluateExperiment({ baseline:0.90, candidate:0.92, sampleSize:50 });
  assert.equal(releaseDecision(proposal, experiment, { passed:false }).decision, 'BLOCK');
});

test('self-deployment cannot touch regulated or live-money changes', () => {
  assert.equal(canSelfDeploy({ regulated:true, securityPassed:true, testsPassed:true }), false);
  assert.equal(canSelfDeploy({ liveMoneyMovement:true, securityPassed:true, testsPassed:true }), false);
  assert.equal(canSelfDeploy({ securityPassed:true, testsPassed:true }), true);
});
