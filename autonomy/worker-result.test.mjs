import assert from 'node:assert/strict';
import { classifyAgentWorkerResult } from './worker-result.mjs';

assert.deepEqual(classifyAgentWorkerResult({ status: 'progressed', progressed: 2, plans: [{ planId: 'p1', status: 'completed' }] }), { status: 'completed' });
assert.deepEqual(classifyAgentWorkerResult({ status: 'idle', plans: [] }), { status: 'completed' });
assert.equal(classifyAgentWorkerResult({ status: 'failed', reason: 'adapter-failed' }).status, 'failed');
assert.equal(classifyAgentWorkerResult({ status: 'progressed', plans: [{ planId: 'p2', status: 'blocked' }] }).status, 'failed');
assert.equal(classifyAgentWorkerResult({ status: 'waiting', plans: [{ planId: 'p3', status: 'awaiting_approval' }] }).status, 'waiting');
assert.equal(classifyAgentWorkerResult({ status: 'queued', plans: [{ planId: 'p4', status: 'queued' }] }).status, 'waiting');
assert.equal(classifyAgentWorkerResult({ status: 'unknown', plans: [] }).status, 'waiting');

console.log('[PASS] Worker results cannot be marked complete while work is blocked, waiting, queued, or unconfirmed.');
