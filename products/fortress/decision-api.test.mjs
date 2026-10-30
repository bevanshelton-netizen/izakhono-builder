import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, createDecisionEvent } from './decision-api.mjs';

test('rejects incomplete requests fail-closed', () => {
  const result = decide({ requestId: 't1' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'MISSING_SUBJECT_ID');
  assert.equal(result.safety.liveMoneyMovement, false);
});

test('returns bounded decision with reasons and audit evidence', () => {
  const result = decide({
    requestId: 't2',
    subjectId: 'synthetic-subject-1',
    transaction: { id: 'txn-1', amount: 2500, currency: 'ZAR' },
    signals: { accountTakeover: true, newBeneficiary: true }
  });
  assert.equal(result.ok, true);
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasonCodes.includes('ACCOUNT_TAKEOVER_SIGNAL'));
  assert.ok(result.auditId);
  assert.equal(result.safety.sandboxOnly, true);
  assert.equal(result.safety.liveMoneyMovement, false);
});

test('creates an immutable-shaped telemetry event without financial control', () => {
  const response = decide({
    requestId: 't3', subjectId: 'synthetic-subject-2',
    transaction: { id: 'txn-2', amount: 100, currency: 'ZAR' },
    signals: { highValueCustomer: true }
  });
  const event = createDecisionEvent(response);
  assert.equal(event.eventType, 'FORTRESS_DECISION');
  assert.equal(event.auditId, response.auditId);
  assert.equal(event.liveMoneyMovement, false);
});
