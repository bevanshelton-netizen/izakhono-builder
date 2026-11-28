import assert from 'node:assert/strict';
import { classifyAgentWorkerResult } from './worker-result.mjs';

assert.deepEqual(classifyAgentWorkerResult({ status: 'progressed', progressed: 2, plans: [{ planId: 'p1', status: 'completed' }] }), { status: 'completed', idle: false });
assert.deepEqual(classifyAgentWorkerResult({ status: 'idle', progressed: 0, plans: [] }), { status: 'completed', idle: true, reason: 'agent-queue-inspected-no-ready-work' });
assert.equal(classifyAgentWorkerResult({ status: 'busy', progressed: 0, plans: [] }).status, 'waiting');
assert.equal(classifyAgentWorkerResult({ status: 'recovery_required', progressed: 0, plans: [] }).status, 'waiting');
assert.equal(classifyAgentWorkerResult({ status: 'progressed', progressed: 1, plans: [{ status: 'waiting' }] }).status, 'waiting');
assert.equal(classifyAgentWorkerResult({ status: 'progressed', progressed: 1, plans: [{ status: 'awaiting_approval' }] }).status, 'waiting');
assert.equal(classifyAgentWorkerResult({ status: 'progressed', progressed: 1, plans: [{ status: 'queued' }] }).status, 'waiting');
assert.equal(classifyAgentWorkerResult({ status: 'progressed', progressed: 1, plans: [{ status: 'blocked' }] }).status, 'failed');
assert.equal(classifyAgentWorkerResult({ status: 'failed', reason: 'adapter-error' }).status, 'failed');
assert.equal(classifyAgentWorkerResult({ status: 'progressed', progressed: 0, plans: [{ status: 'completed' }] }).status, 'waiting');

console.log('Agent worker result classification tests passed');
