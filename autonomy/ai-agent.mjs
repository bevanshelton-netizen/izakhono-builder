import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const queuePath = process.env.IZAKHONO_AGENT_QUEUE_PATH || path.join(root, 'autonomy', 'agent-queue.json');
const statePath = process.env.IZAKHONO_AGENT_STATE_PATH || path.join(root, 'autonomy', 'agent-state.json');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

export function createPlan(request = {}) {
  if (!request.goal) throw new Error('goal is required');
  const planId = crypto.randomUUID();
  const steps = Array.isArray(request.steps) && request.steps.length
    ? request.steps.map((step, index) => ({
        id: step.id || `${planId}-step-${index + 1}`,
        title: step.title || `Step ${index + 1}`,
        action: step.action || 'manual-review',
        status: 'queued',
        dependsOn: step.dependsOn || (index ? [request.steps[index - 1].id || `${planId}-step-${index}`] : []),
        evidence: step.evidence || [],
      }))
    : [{ id: `${planId}-step-1`, title: 'Decompose goal', action: 'plan-only', status: 'queued', dependsOn: [], evidence: ['plan-recorded'] }];
  const plan = { schema: 'izakhono.agent-plan/v1', planId, goal: request.goal, createdAt: new Date().toISOString(), status: 'queued', autonomy: request.autonomy !== false, approvalRequired: request.approvalRequired === true, steps };
  const state = readJson(statePath, { schema: 'izakhono.agent-state/v1', plans: {} });
  state.plans[planId] = plan;
  writeJson(statePath, state);
  return plan;
}

export function nextReadyStep(plan) {
  return plan.steps.find((step) => step.status === 'queued' && step.dependsOn.every((id) => plan.steps.find((candidate) => candidate.id === id)?.status === 'completed')) || null;
}

export function enqueue(request = {}) {
  const queue = readJson(queuePath, { schema: 'izakhono.agent-queue/v1', items: [] });
  const plan = createPlan(request);
  queue.items.push({ id: crypto.randomUUID(), planId: plan.planId, queuedAt: new Date().toISOString(), status: 'queued' });
  writeJson(queuePath, queue);
  return plan;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [operation = 'plan', payload = '{}'] = process.argv.slice(2);
  const input = JSON.parse(payload);
  const result = operation === 'enqueue' ? enqueue(input) : createPlan(input);
  console.log(JSON.stringify(result, null, 2));
}
