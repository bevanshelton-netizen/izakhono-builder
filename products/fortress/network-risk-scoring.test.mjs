import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreNetworkRisk, buildNetworkDecision } from './network-risk-scoring.mjs';

test('empty network produces zero risk', () => {
  const result = scoreNetworkRisk([]);
  assert.equal(result.score, 0);
  assert.equal(result.band, 'LOW');
});

test('coordinated patterns increase network risk with explainable evidence', () => {
  const result = scoreNetworkRisk([
    { type: 'ACCOUNT_TAKEOVER_CLUSTER', score: 90, confidence: 95, evidenceCount: 4, reasonCodes: ['ATO_CLUSTER'] },
    { type: 'SHARED_DEVICE', score: 70, confidence: 90, evidenceCount: 3, reasonCodes: ['SHARED_DEVICE'] },
    { type: 'VELOCITY_CLUSTER', score: 80, confidence: 85, evidenceCount: 5, reasonCodes: ['VELOCITY_PATTERN'] },
  ]);
  assert.ok(result.score >= 40);
  assert.ok(result.confidence > 0);
  assert.ok(result.reasons.includes('ATO_CLUSTER'));
  assert.ok(result.contributors.length === 3);
});

test('network decision remains bounded and non-financial', () => {
  const result = buildNetworkDecision({
    eventId: 'evt-synthetic-1',
    subjectId: 'subject-synthetic-1',
    patterns: [
      { type: 'MERCHANT_COMPROMISE_PATTERN', score: 95, confidence: 95, evidenceCount: 6, reasonCodes: ['MERCHANT_CLUSTER'] },
      { type: 'COORDINATED_TRANSACTION_PATTERN', score: 90, confidence: 90, evidenceCount: 5, reasonCodes: ['COORDINATED_ACTIVITY'] },
    ],
  });
  assert.ok(result.decision);
  assert.ok(result.reasonCodes.includes('MERCHANT_CLUSTER'));
  assert.equal(result.moneyMovement, false);
  assert.equal(result.sandboxOnly, true);
  assert.equal(result.liveMoneyMovement, false);
});

test('identical inputs are deterministic except timestamp fields', () => {
  const input = {
    eventId: 'evt-deterministic',
    subjectId: 'subject-deterministic',
    patterns: [{ type: 'SHARED_COUNTERPARTY', score: 60, confidence: 80, evidenceCount: 2, reasonCodes: ['SHARED_COUNTERPARTY'] }],
  };
  const a = scoreNetworkRisk(input.patterns);
  const b = scoreNetworkRisk(input.patterns);
  assert.deepEqual(a, b);
});
