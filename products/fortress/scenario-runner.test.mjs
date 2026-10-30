import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateScenario, runScenario, runSuite } from './scenario-runner.mjs';

test('high-confidence coordinated fraud is blocked', () => {
  const result = evaluateScenario({
    id: 'ring-001',
    signals: { coordinatedRing: true, muleNetwork: true, accountTakeover: true },
  });
  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.liveMoneyMovement, false);
});

test('new beneficiary social engineering is challenged', () => {
  const result = runScenario({
    id: 'scam-001',
    signals: { newBeneficiary: true, socialEngineering: true },
    expected: { decision: 'CHALLENGE', requiredReason: 'NEW_BENEFICIARY' },
  });
  assert.equal(result.pass, true);
});

test('benign high-value customer context does not create a block by itself', () => {
  const result = evaluateScenario({
    id: 'customer-001',
    signals: { highValueCustomer: true },
  });
  assert.equal(result.decision, 'ALLOW');
});

test('suite remains sandbox-only', () => {
  const result = runSuite([
    { id: 'a', signals: { accountTakeover: true }, expected: { decision: 'CHALLENGE' } },
    { id: 'b', signals: { muleNetwork: true, coordinatedRing: true }, expected: { decision: 'BLOCK' } },
  ]);
  assert.equal(result.total, 2);
  assert.equal(result.failed, 0);
  assert.equal(result.sandboxOnly, true);
  assert.equal(result.liveMoneyMovement, false);
});
