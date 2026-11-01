import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-agent-'));
process.env.IZAKHONO_AGENT_STATE_PATH = path.join(temp, 'state.json');
process.env.IZAKHONO_AGENT_QUEUE_PATH = path.join(temp, 'queue.json');

const { createPlan, nextReadyStep, enqueue } = await import('./ai-agent.mjs');

const plan = createPlan({
  goal: 'Build a customer website',
  steps: [
    { id: 'design', title: 'Design', action: 'design', evidence: ['design-recorded'] },
    { id: 'build', title: 'Build', action: 'build', dependsOn: ['design'], evidence: ['build-recorded'] }
  ]
});
assert.equal(plan.status, 'queued');
assert.equal(nextReadyStep(plan).id, 'design');
plan.steps[0].status = 'completed';
assert.equal(nextReadyStep(plan).id, 'build');
const queued = enqueue({ goal: 'Provision a tenant' });
assert.equal(queued.goal, 'Provision a tenant');
assert.equal(JSON.parse(fs.readFileSync(process.env.IZAKHONO_AGENT_QUEUE_PATH, 'utf8')).items.length, 1);
console.log('[PASS] IZAKHONO AI agent planning engine');
