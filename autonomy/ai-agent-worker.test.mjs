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

console.log('[PASS] AI agent worker drains native Builder stages and records portable build artifacts.');
