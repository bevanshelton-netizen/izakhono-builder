import assert from 'node:assert/strict';
import {
  SANDBOX_SCENARIOS,
  createSandboxMerchant,
  issueSandboxKey,
  simulatePayment,
  runSandboxSuite
} from './index.mjs';

const merchant = createSandboxMerchant({ id: 'test_merchant_qc' });
assert.equal(merchant.environment, 'sandbox');
assert.equal(merchant.funds_movement, 'none');

const key = issueSandboxKey(merchant.id);
assert.match(key, /^sk_test_/);

for (const scenario of SANDBOX_SCENARIOS) {
  const result = simulatePayment({ scenario, amountMinor: 1250, currency: 'ZAR', idempotencyKey: `qc_${scenario}` });
  assert.equal(result.environment, 'sandbox');
  assert.equal(result.funds_movement, 'none');
  assert.equal(result.simulated, true);
}

assert.throws(
  () => simulatePayment({ scenario: 'approved', amountMinor: 0, idempotencyKey: 'bad' }),
  /positive safe integer/
);
assert.throws(
  () => simulatePayment({ scenario: 'unknown', amountMinor: 100, idempotencyKey: 'bad' }),
  /Unknown sandbox scenario/
);
assert.throws(
  () => simulatePayment({ scenario: 'approved', amountMinor: 100 }),
  /idempotencyKey is required/
);

const suite = runSandboxSuite();
assert.equal(suite.passed, true);
assert.equal(suite.results.length, SANDBOX_SCENARIOS.length);

console.log(`IZAKHONO PAY sandbox QC: GREEN (${suite.results.length}/${SANDBOX_SCENARIOS.length} scenarios)`);
