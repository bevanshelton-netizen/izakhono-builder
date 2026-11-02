import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROVISIONING_STEPS,
  idempotencyKey,
  isTerminalReady,
  isValidStatus,
  isValidStep,
  nextStep,
} from './provisioning-contract.js';

test('defines the complete customer provisioning chain', () => {
  assert.equal(PROVISIONING_STEPS[0], 'payment_verified');
  assert.equal(PROVISIONING_STEPS.at(-1), 'service_ready');
  assert.equal(PROVISIONING_STEPS.length, 13);
});

test('accepts only known steps and terminal statuses', () => {
  assert.equal(isValidStep('dns_configured'), true);
  assert.equal(isValidStep('invented_step'), false);
  assert.equal(isValidStatus('completed'), true);
  assert.equal(isValidStatus('running'), false);
});

test('advances deterministically', () => {
  assert.equal(nextStep('payment_verified'), 'customer_created');
  assert.equal(nextStep('access_delivered'), 'service_ready');
  assert.equal(nextStep('service_ready'), null);
});

test('marks readiness only at the terminal completed step', () => {
  assert.equal(isTerminalReady('service_ready', 'completed'), true);
  assert.equal(isTerminalReady('service_ready', 'failed'), false);
  assert.equal(isTerminalReady('access_delivered', 'completed'), false);
});

test('generates stable idempotency keys', () => {
  assert.equal(
    idempotencyKey({ orderId: 'ORD-1', step: 'dns_configured', attempt: 2 }),
    'provision:ORD-1:dns_configured:2',
  );
});
