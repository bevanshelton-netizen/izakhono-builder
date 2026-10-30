import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCreateCase,
  buildCreateCase,
  validateTransition,
  buildTransition,
  buildEvidence,
  buildAssignment,
  assertDecisionSafety
} from './case-management-api.mjs';

test('creates a bounded sandbox case', () => {
  const result = buildCreateCase({
    caseNumber: 'FRT-TEST-001', subjectId: 'synthetic-subject', decision: 'HOLD_FOR_REVIEW',
    riskScore: 91, reasonCodes: ['RAT_SIGNAL','VELOCITY_ANOMALY']
  });
  assert.equal(result.ok, true);
  assert.equal(result.case.status, 'ALERT_CREATED');
  assert.equal(result.safety.liveMoneyMovement, false);
});

test('rejects consequential decision without reason codes', () => {
  assert.equal(validateCreateCase({ caseNumber:'FRT-1', subjectId:'s1', decision:'BLOCK', riskScore:99 }).ok, false);
});

test('allows the controlled investigation lifecycle', () => {
  assert.equal(validateTransition('ALERT_CREATED','TRIAGED').ok, true);
  assert.equal(validateTransition('TRIAGED','INVESTIGATING').ok, true);
  assert.equal(validateTransition('INVESTIGATING','RESOLVED', { disposition:'CONFIRMED_FRAUD' }).ok, true);
  assert.equal(validateTransition('RESOLVED','CLOSED', { evidenceCount:1 }).ok, true);
});

test('rejects invalid lifecycle jumps', () => {
  assert.equal(validateTransition('ALERT_CREATED','CLOSED').ok, false);
  assert.equal(validateTransition('CLOSED','INVESTIGATING').ok, false);
});

test('requires evidence before closure', () => {
  assert.equal(validateTransition('RESOLVED','CLOSED', { evidenceCount:0 }).ok, false);
});

test('requires a disposition before resolution', () => {
  assert.equal(validateTransition('INVESTIGATING','RESOLVED').ok, false);
});

test('builds immutable evidence references', () => {
  const result = buildEvidence({ caseId:'case-1', evidenceType:'TRANSACTION', referenceId:'tx-1', contentHash:'sha256:abc', actorId:'analyst-1' });
  assert.equal(result.ok, true);
  assert.equal(result.evidence.content_hash, 'sha256:abc');
  assert.equal(result.safety.liveMoneyMovement, false);
});

test('builds controlled assignment event', () => {
  const result = buildAssignment({ caseId:'case-1', assignedTo:'analyst-1', actorId:'supervisor-1' });
  assert.equal(result.ok, true);
  assert.equal(result.event.eventType, 'CASE_ASSIGNED');
});

test('forbids live-money movement in API contract', () => {
  const result = buildCreateCase({ caseNumber:'FRT-2', subjectId:'s2', decision:'ALLOW', riskScore:5, safety:{liveMoneyMovement:true} });
  assert.equal(result.ok, false);
  assert.equal(assertDecisionSafety('BLOCK', ['RISK']).ok, true);
});