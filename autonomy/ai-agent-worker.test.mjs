import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-agent-test-'));
process.env.IZAKHONO_AGENT_STATE_PATH = path.join(dir, 'state.json');
process.env.IZAKHONO_AGENT_QUEUE_PATH = path.join(dir, 'queue.json');

const { createPlan, enqueue } = await import('./ai-agent.mjs');
const { runAgentWorker } = await import('./ai-agent-worker.mjs');

const plan = createPlan({
  goal: 'Test autonomous plan progression',
  steps: [
    { id: 'first', title: 'Record first step', action: 'plan-only', evidence: ['plan-recorded'] },
    { id: 'second', title: 'Record second step', action: 'plan-only', dependsOn: ['first'], evidence: ['plan-recorded'] },
  ],
});
assert.equal(plan.status, 'queued');

const queued = enqueue({ goal: 'Test queued autonomous plan', steps: [{ id: 'queued-first', action: 'plan-only' }] });
assert.equal(queued.status, 'queued');

const result = await runAgentWorker();
assert.equal(result.status, 'progressed');
assert.ok(result.progressed >= 1);

const state = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, 'utf8'));
const queuedState = state.plans[queued.planId];
assert.equal(queuedState.steps[0].status, 'completed');
assert.equal(queuedState.status, 'completed');

console.log('[PASS] AI agent worker executes queued plans and persists completion state.');
