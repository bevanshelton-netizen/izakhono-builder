import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeNetwork, runNetworkPipeline } from './network-intelligence.mjs';

test('benign network posture remains monitored', () => {
  const result = analyzeNetwork({ signals: { evidenceCount: 1 } });
  assert.equal(result.decision, 'ALLOW_WITH_MONITORING');
  assert.equal(result.safety.sandboxOnly, true);
  assert.equal(result.safety.liveMoneyMovement, false);
});

test('coordinated activity produces explainable network risk', () => {
  const result = analyzeNetwork({ signals: { coordinatedActivity: true, sharedDeviceSubjects: 3, evidenceCount: 4 } });
  assert.ok(result.score >= 45);
  assert.ok(result.reasonCodes.includes('NETWORK_COORDINATED_ACTIVITY'));
  assert.ok(result.reasonCodes.includes('NETWORK_SHARED_DEVICE'));
});

test('high network risk becomes a bounded review decision', () => {
  const result = analyzeNetwork({ signals: { accountTakeoverCluster: true, merchantCompromise: true, coordinatedActivity: true, evidenceCount: 10 } });
  assert.equal(result.riskBand, 'HIGH');
  assert.equal(result.decision, 'HOLD_FOR_REVIEW');
  assert.equal(result.safety.liveMoneyMovement, false);
});

test('pipeline produces a sandbox risk event only', () => {
  const { riskEvent } = runNetworkPipeline({ subjectId: 'synthetic-subject', transactionId: 'synthetic-tx', signals: { rapidRiskSequence: true, evidenceCount: 2 } });
  assert.equal(riskEvent.eventType, 'FORTRESS_NETWORK_RISK');
  assert.equal(riskEvent.sandboxOnly, true);
  assert.equal(riskEvent.liveMoneyMovement, false);
});
