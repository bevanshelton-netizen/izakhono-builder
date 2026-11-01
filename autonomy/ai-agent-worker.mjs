import fs from 'node:fs';
import path from 'node:path';
import { nextReadyStep } from './ai-agent.mjs';
import { runNodeAdapter } from './node-adapter.mjs';
import { runBuilderAdapter } from './builder-adapter.mjs';

const root = process.cwd();
const statePath = process.env.IZAKHONO_AGENT_STATE_PATH || path.join(root, 'autonomy', 'agent-state.json');
const queuePath = process.env.IZAKHONO_AGENT_QUEUE_PATH || path.join(root, 'autonomy', 'agent-queue.json');

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

async function execute(step) {
  const nodeActions = new Set([
    'node-discovery',
    'software-node-instantiation',
    'node-heartbeat',
    'node-evidence',
    'node-target',
    'node-readiness',
    'workload-schedule',
    'kora-workload-execute',
    'kora-routing-acceptance',
  ]);

  if (nodeActions.has(step.action)) {
    return runNodeAdapter(step.action, {
      taskTitle: step.title,
      evidenceRequired: step.evidence || [],
      requirements: step.requirements || {},
      workload: step.workload || undefined,
      selectedNode: step.selectedNode || undefined,
    });
  }

  if (step.action === 'run-worker' || step.action === 'adapter-contract') {
    return runBuilderAdapter({ ...step, action: step.action });
  }

  if (step.action === 'plan-only') {
    return { status: 'completed', evidence: [{ name: 'plan-recorded', status: 'passed' }] };
  }

  return { status: 'waiting', reason: `unsupported-agent-action:${step.action}` };
}

function applyResult(plan, step, result) {
  const evidence = result.evidence || [];
  if (result.status === 'completed' || result.status === 'assigned' || result.status === 'ready' || result.status === 'eligible') {
    step.status = 'completed';
    step.completedAt = new Date().toISOString();
    step.result = result;
    step.evidenceResult = evidence;
    return 'completed';
  }

  if (result.status === 'waiting') {
    step.status = 'waiting';
    step.reason = result.reason || 'capability-required';
    step.result = result;
    step.evidenceResult = evidence;
    return 'waiting';
  }

  step.status = 'failed';
  step.reason = result.reason || 'agent-step-failed';
  step.result = result;
  step.evidenceResult = evidence;
  return 'failed';
}

export async function runAgentWorker() {
  const state = readJson(statePath, { schema: 'izakhono.agent-state/v1', plans: {} });
  const queue = readJson(queuePath, { schema: 'izakhono.agent-queue/v1', items: [] });
  let progressed = 0;

  for (const item of queue.items.filter((entry) => entry.status === 'queued' || entry.status === 'running')) {
    const plan = state.plans[item.planId];
    if (!plan || plan.status === 'completed' || plan.status === 'blocked') continue;
    if (plan.approvalRequired && !plan.approved) {
      item.status = 'awaiting_approval';
      plan.status = 'awaiting_approval';
      continue;
    }

    const step = nextReadyStep(plan);
    if (!step) {
      const remaining = plan.steps.some((candidate) => !['completed'].includes(candidate.status));
      if (!remaining) {
        plan.status = 'completed';
        item.status = 'completed';
        plan.completedAt = new Date().toISOString();
      } else {
        plan.status = 'waiting';
        item.status = 'waiting';
      }
      continue;
    }

    item.status = 'running';
    plan.status = 'running';
    step.status = 'running';
    step.startedAt = new Date().toISOString();

    const result = await execute(step);
    applyResult(plan, step, result);
    progressed += 1;

    if (step.status === 'failed') {
      plan.status = 'blocked';
      item.status = 'blocked';
    } else if (step.status === 'waiting') {
      plan.status = 'waiting';
      item.status = 'waiting';
    } else if (plan.steps.every((candidate) => candidate.status === 'completed')) {
      plan.status = 'completed';
      item.status = 'completed';
      plan.completedAt = new Date().toISOString();
    } else {
      item.status = 'queued';
    }
  }

  writeJson(statePath, state);
  writeJson(queuePath, queue);
  return {
    schema: 'izakhono.agent-worker/v1',
    status: progressed ? 'progressed' : 'idle',
    progressed,
    plans: Object.values(state.plans).map((plan) => ({ planId: plan.planId, status: plan.status })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAgentWorker().then((result) => console.log(JSON.stringify(result, null, 2)));
}
