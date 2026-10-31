import test from 'node:test';
import assert from 'node:assert/strict';
import { correlateGraph, PATTERN_TYPES } from './threat-graph-correlation.mjs';

test('detects shared-device cluster without asserting guilt', () => {
  const result = correlateGraph({
    nodes: [
      { type: 'device', id: 'device-1' },
      { type: 'account', id: 'account-1' },
      { type: 'account', id: 'account-2' }
    ],
    edges: [
      { source: 'device-1', target: 'account-1' },
      { source: 'device-1', target: 'account-2' }
    ]
  });
  assert.equal(result.patternCount, 1);
  assert.equal(result.patterns[0].patternType, PATTERN_TYPES.SHARED_DEVICE);
  assert.equal(result.sandboxOnly, true);
  assert.equal(result.liveMoneyMovement, false);
});

test('detects high-risk coordinated activity', () => {
  const result = correlateGraph({
    nodes: [
      { type: 'transaction', id: 'tx-1', riskScore: 80 },
      { type: 'transaction', id: 'tx-2', riskScore: 75 }
    ],
    edges: []
  });
  assert.equal(result.patterns[0].patternType, PATTERN_TYPES.COORDINATED_ACTIVITY);
  assert.ok(result.patterns[0].reasonCodes.includes('MULTIPLE_HIGH_RISK_TRANSACTIONS'));
});

test('empty graph produces no fabricated intelligence', () => {
  const result = correlateGraph({ nodes: [], edges: [] });
  assert.equal(result.patternCount, 0);
  assert.deepEqual(result.patterns, []);
});
