import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecision, calculateRiskScore, decide, riskBand } from '../core/risk-contract.js';

test('empty signals are low risk', () => {
  const result = calculateRiskScore();
  assert.equal(result.score, 0);
  assert.equal(result.confidence, 0);
  assert.deepEqual(result.reasons, []);
});

test('risk band thresholds are deterministic', () => {
  assert.equal(riskBand(0), 'LOW');
  assert.equal(riskBand(40), 'MEDIUM');
  assert.equal(riskBand(70), 'HIGH');
  assert.equal(riskBand(90), 'CRITICAL');
});

test('decision policy escalates increasing risk', () => {
  assert.equal(decide({ score: 10, confidence: 0.9 }), 'ALLOW');
  assert.equal(decide({ score: 35, confidence: 0.9 }), 'ALLOW_WITH_MONITORING');
  assert.equal(decide({ score: 60, confidence: 0.9 }), 'CHALLENGE');
  assert.equal(decide({ score: 80, confidence: 0.9 }), 'HOLD_FOR_REVIEW');
  assert.equal(decide({ score: 95, confidence: 0.9 }), 'BLOCK');
});

test('high-confidence security policy can block', () => {
  assert.equal(decide({ score: 50, confidence: 0.9, highConfidenceBlock: true }), 'BLOCK');
  assert.notEqual(decide({ score: 50, confidence: 0.7, highConfidenceBlock: true }), 'BLOCK');
});

test('decision contract is explicit and money movement is disabled', () => {
  const result = buildDecision({
    eventId: 'evt-1',
    subjectId: 'acct-1',
    signals: {
      device: { score: 80, confidence: 90, reasonCodes: ['RAT_SIGNAL'] },
      behaviour: { score: 60, confidence: 80, reasonCodes: ['VELOCITY_ANOMALY'] },
    },
    context: { channel: 'mobile' },
  });

  assert.equal(result.eventId, 'evt-1');
  assert.equal(result.subjectId, 'acct-1');
  assert.equal(result.moneyMovement, false);
  assert.ok(result.reasonCodes.includes('RAT_SIGNAL'));
  assert.ok(result.reasonCodes.includes('VELOCITY_ANOMALY'));
});

test('required identifiers are enforced', () => {
  assert.throws(() => buildDecision({ subjectId: 'acct-1' }), /eventId and subjectId/);
  assert.throws(() => buildDecision({ eventId: 'evt-1' }), /eventId and subjectId/);
});
