import test from 'node:test';
import assert from 'node:assert/strict';

function splitMinorUnits(distributableMinor, creatorShareBps) {
  if (!Number.isSafeInteger(distributableMinor) || distributableMinor < 0) throw new Error('Invalid distributable amount');
  if (!Number.isInteger(creatorShareBps) || creatorShareBps < 0 || creatorShareBps > 10000) throw new Error('Invalid share basis points');
  const creator = Math.floor((distributableMinor * creatorShareBps) / 10000);
  return { creator, platform: distributableMinor - creator };
}

test('allocation conserves every minor unit', () => {
  for (let amount = 0; amount < 100000; amount += 137) {
    const result = splitMinorUnits(amount, 8000);
    assert.equal(result.creator + result.platform, amount);
  }
});

test('allocation uses basis points and integer minor units', () => {
  assert.deepEqual(splitMinorUnits(10001, 8000), { creator: 8000, platform: 2001 });
});

test('rejects negative, fractional and unsafe amounts', () => {
  assert.throws(() => splitMinorUnits(-1, 8000));
  assert.throws(() => splitMinorUnits(1.5, 8000));
  assert.throws(() => splitMinorUnits(Number.MAX_SAFE_INTEGER + 1, 8000));
});

test('rejects invalid share rates', () => {
  for (const share of [-1, 10001, 12.5, NaN]) assert.throws(() => splitMinorUnits(100, share));
});

test('zero and full creator allocations are valid', () => {
  assert.deepEqual(splitMinorUnits(999, 0), { creator: 0, platform: 999 });
  assert.deepEqual(splitMinorUnits(999, 10000), { creator: 999, platform: 0 });
});
