import test from 'node:test';
import assert from 'node:assert/strict';
import { genericPoints, summariseResults } from './sports-intelligence.js';

test('generic scoring prefers explicit points', () => {
  assert.equal(genericPoints(1, 11), 11);
  assert.equal(genericPoints(1), 3);
  assert.equal(genericPoints(2), 2);
  assert.equal(genericPoints(3), 1);
  assert.equal(genericPoints(7), 0);
});

test('lastResult preserves chronological input order', () => {
  const results = [
    { resultId: 'a', participantKey: 'p', score: 10, placing: 1, points: 3 },
    { resultId: 'b', participantKey: 'p', score: 8, placing: 4, points: 0 },
    { resultId: 'c', participantKey: 'p', score: 12, placing: 2, points: 2 }
  ];
  const summary = summariseResults(results);
  assert.equal(summary.lastResult?.resultId, 'c');
  assert.equal(summary.wins, 1);
  assert.equal(summary.podiums, 2);
  assert.equal(summary.points, 5);
});
