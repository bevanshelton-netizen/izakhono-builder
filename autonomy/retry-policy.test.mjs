import assert from 'node:assert/strict';
import { retryDelayMs, waitingRetryDue } from './retry-policy.mjs';

assert.equal(retryDelayMs(1), 5 * 60 * 1000);
assert.equal(retryDelayMs(2), 10 * 60 * 1000);
assert.equal(retryDelayMs(3), 20 * 60 * 1000);
assert.equal(retryDelayMs(816), 6 * 60 * 60 * 1000);

const now = Date.parse('2026-11-26T10:00:00.000Z');
assert.equal(waitingRetryDue({ status: 'waiting', retryAfter: '2026-11-26T10:05:00.000Z' }, now), false);
assert.equal(waitingRetryDue({ status: 'waiting', retryAfter: '2026-11-26T09:59:00.000Z' }, now), true);
assert.equal(waitingRetryDue({ status: 'waiting', attempts: 816, updatedAt: '2026-11-26T04:00:01.000Z' }, now), false);
assert.equal(waitingRetryDue({ status: 'waiting', attempts: 816, updatedAt: '2026-11-26T04:00:01.000Z' }, now + 2), true);
assert.equal(waitingRetryDue({ status: 'completed' }, now), true);
assert.equal(waitingRetryDue({ status: 'waiting_owner', retryAfter: '2026-11-26T10:05:00.000Z' }, now), false);
assert.equal(waitingRetryDue({ status: 'waiting' }, now), true);

console.log('Autonomy retry policy tests passed');
