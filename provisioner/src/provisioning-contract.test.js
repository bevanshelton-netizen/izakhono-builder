import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROVISIONING_STEPS,
  isTerminalReady,
  isValidStatus,
  isValidStep,
  nextStep,
  stepIdempotencyKey,
} from './provisioning-contract.js';

test('mirrors the executable Supabase provisioning chain', () => {
  assert.equal(PROVISIONING_STEPS[0], 'payment_verified');
  assert.equal(PROVISIONING_STEPS.at(-1), 'handover_ready');
  assert.equal(PROVISIONING_STEPS.length, 11);
});

test('accepts only executable steps and terminal statuses', () => {
  assert.equal(isValidStep('dns_configured'), true);
  assert.equal(isValidStep('invented_step'), false);
  assert.equal(isValidStatus('completed'), true);
  assert.equal(isValidStatus('running'), false);
});

test('advances deterministically', () => {
  assert.equal(nextStep('payment_verified'), 'account_ready');
  assert.equal(nextStep('verification_complete'), 'handover_ready');
  assert.equal(nextStep('handover_ready'), null);
});

test('marks readiness only at terminal handover', () => {
  assert.equal(isTerminalReady('handover_ready', 'completed'), true);
  assert.equal(isTerminalReady('handover_ready', 'failed'), false);
  assert.equal(isTerminalReady('verification_complete', 'completed'), false);
});

test('generates a job-step idempotency key', () => {
  assert.equal(
    stepIdempotencyKey({ jobId: 'JOB-1', step: 'dns_configured' }),
    'provision:JOB-1:dns_configured',
  );
});
