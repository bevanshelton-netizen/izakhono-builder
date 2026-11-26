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

const lockPath = `${process.env.IZAKHONO_AGENT_STATE_PATH}.worker.lock`;
fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999, startedAt: new Date().toISOString() }));
assert.throws(() => createPlan({ goal: 'Must not race worker state' }), { code: 'EAGENTBUSY' });
assert.throws(() => enqueue({ goal: 'Must not race worker queue' }), { code: 'EAGENTBUSY' });
const busy = await runAgentWorker();
assert.equal(busy.status, 'busy');
assert.equal(busy.progressed, 0);
fs.unlinkSync(lockPath);

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

// A worker that fails while reading state must release its exclusive lock.
fs.writeFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, '{ invalid json');
await assert.rejects(runAgentWorker(), SyntaxError);
assert.equal(fs.existsSync(lockPath), false);

// A process restart must quarantine an in-flight step instead of replaying a possibly non-idempotent action.
fs.writeFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, JSON.stringify({ schema: 'izakhono.agent-state/v1', plans: {} }, null, 2));
fs.writeFileSync(process.env.IZAKHONO_AGENT_QUEUE_PATH, JSON.stringify({ schema: 'izakhono.agent-queue/v1', items: [] }, null, 2));
const interruptedItemPlan = enqueue({
  goal: 'Verify interrupted work is not automatically replayed',
  steps: [{ id: 'possibly-side-effecting', title: 'Potential external side effect', action: 'builder-generate' }],
});
const interruptedState = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, 'utf8'));
const interruptedQueue = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_QUEUE_PATH, 'utf8'));
interruptedState.plans[interruptedItemPlan.planId].status = 'running';
interruptedState.plans[interruptedItemPlan.planId].steps[0].status = 'running';
for (const item of interruptedQueue.items) item.status = 'running';
fs.writeFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, JSON.stringify(interruptedState, null, 2));
fs.writeFileSync(process.env.IZAKHONO_AGENT_QUEUE_PATH, JSON.stringify(interruptedQueue, null, 2));
const recovery = await runAgentWorker();
assert.equal(recovery.status, 'recovery_required');
assert.equal(recovery.progressed, 0);
const recoveredState = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_STATE_PATH, 'utf8'));
const recoveredQueue = JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_QUEUE_PATH, 'utf8'));
assert.equal(recoveredState.plans[interruptedItemPlan.planId].status, 'interrupted');
assert.ok(recoveredQueue.items.every((item) => item.status === 'interrupted'));

console.log('[PASS] AI agent worker drains native Builder stages, records portable artifacts, rejects concurrent execution, releases its lock after failure, and quarantines interrupted work for explicit recovery.');
