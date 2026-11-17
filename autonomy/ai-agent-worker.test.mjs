import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-agent-test-'));
process.env.IZAKHONO_AGENT_STATE_PATH = path.join(dir, 'state.json');
process.env.IZAKHONO_AGENT_QUEUE_PATH = path.join(dir, 'queue.json');
process.env.IZAKHONO_BUILD_ARTIFACT_ROOT = path.join(dir, 'artifacts');
process.env.IZAKHONO_AGENT_MAX_STEPS_PER_RUN = '25';

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

const queued = enqueue({ goal: 'Build a native web application artifact' });
assert.equal(queued.status, 'queued');

const result = await runAgentWorker();
assert.equal(result.status, 'progressed');
assert.ok(result.progressed >= 1);

const state = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, 'utf8'));
const queuedState = state.plans[queued.planId];
assert.equal(queuedState.status, 'completed');
assert.ok(queuedState.steps.every((step) => step.status === 'completed'));
assert.ok(queuedState.steps.every((step) => step.artifactPath));

const artifactDir = path.join(process.env.IZAKHONO_BUILD_ARTIFACT_ROOT, queued.planId);
assert.ok(fs.existsSync(path.join(artifactDir, 'architecture.json')));
assert.ok(fs.existsSync(path.join(artifactDir, 'package.json')));
assert.ok(fs.existsSync(path.join(artifactDir, 'index.mjs')));
assert.ok(fs.existsSync(path.join(artifactDir, 'build-result.json')));

const retryPlan = enqueue({
  goal: 'Recover a waiting task after its missing capability is supplied',
  steps: [{ id: 'retry-step', title: 'Retry after capability recovery', action: 'manual-review' }],
});
await runAgentWorker();
let recoveryState = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, 'utf8'));
assert.equal(recoveryState.plans[retryPlan.planId].status, 'waiting');
recoveryState.plans[retryPlan.planId].steps[0].action = 'plan-only';
fs.writeFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, JSON.stringify(recoveryState, null, 2) + '\n');
await runAgentWorker();
recoveryState = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, 'utf8'));
assert.equal(recoveryState.plans[retryPlan.planId].status, 'completed');

const approvalPlan = enqueue({
  goal: 'Resume a plan after explicit approval',
  approvalRequired: true,
  steps: [{ id: 'approved-step', title: 'Approved safe step', action: 'plan-only' }],
});
await runAgentWorker();
let approvalState = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, 'utf8'));
assert.equal(approvalState.plans[approvalPlan.planId].status, 'awaiting_approval');
approvalState.plans[approvalPlan.planId].approved = true;
fs.writeFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, JSON.stringify(approvalState, null, 2) + '\n');
await runAgentWorker();
approvalState = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, 'utf8'));
assert.equal(approvalState.plans[approvalPlan.planId].status, 'completed');

console.log('[PASS] AI agent worker drains native Builder stages and records portable build artifacts.');
