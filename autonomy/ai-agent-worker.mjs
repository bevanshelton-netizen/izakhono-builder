import fs from 'node:fs';
import path from 'node:path';
import { nextReadyStep } from './ai-agent.mjs';
import { runNodeAdapter } from './node-adapter.mjs';
import { runBuilderAdapter } from './builder-adapter.mjs';

const root = process.cwd();
const dataRoot = process.env.IZAKHONO_NODE_DATA_DIR || path.join(root, '.izakhono-private');
const statePath = process.env.IZAKHONO_AGENT_STATE_PATH || path.join(dataRoot, 'agent-state.json');
const queuePath = process.env.IZAKHONO_AGENT_QUEUE_PATH || path.join(dataRoot, 'agent-queue.json');

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

async function execute(step, plan) {
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

  const nativeBuilderActions = new Set([
    'run-worker',
    'adapter-contract',
    'plan-only',
    'builder-scaffold',
    'builder-generate',
    'builder-validate',
    'builder-security',
    'builder-test',
    'builder-package',
  ]);

  if (nativeBuilderActions.has(step.action)) {
    return runBuilderAdapter({
      ...step,
      action: step.action,
      planId: plan.planId,
      goal: plan.goal,
    });
  }

  return { status: 'waiting', reason: `unsupported-agent-action:${step.action}` };
}

function applyResult(step, result) {
  const evidence = result.evidence || [];
  if (['completed', 'assigned', 'ready', 'eligible', 'instantiated'].includes(result.status)) {
    step.status = 'completed';
    step.completedAt = new Date().toISOString();
    step.result = result;
    step.evidenceResult = evidence;
    if (result.selectedNode) step.selectedNode = result.selectedNode;
    if (result.artifactPath) step.artifactPath = result.artifactPath;
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

function acquireWorkerLock() {
  const lockPath = `${statePath}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const staleAfterMs = Number(process.env.IZAKHONO_AGENT_LOCK_STALE_MS || 900000);
  try {
    const fd = fs.openSync(lockPath, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    fs.closeSync(fd);
    return () => {
      try {
        const current = readJson(lockPath, null);
        if (current?.pid === process.pid) fs.unlinkSync(lockPath);
      } catch {}
    };
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const current = readJson(lockPath, null);
    let alive = false;
    if (Number.isInteger(current?.pid)) {
      try { process.kill(current.pid, 0); alive = true; }
      catch (probeError) { alive = probeError?.code === 'EPERM'; }
    }
    let ageMs = Date.now() - Date.parse(current?.startedAt || '');
    if (!Number.isFinite(ageMs)) {
      try { ageMs = Date.now() - fs.statSync(lockPath).mtimeMs; } catch { ageMs = 0; }
    }
    if (!alive && ageMs > staleAfterMs) {
      try { fs.unlinkSync(lockPath); } catch {}
      return acquireWorkerLock();
    }
    return null;
  }
}

const SAFE_RECOVERY_ACTIONS = new Set([
  'plan-only', 'adapter-contract', 'builder-scaffold', 'builder-generate',
  'builder-validate', 'builder-security', 'builder-test', 'builder-package',
]);

export async function runAgentWorker() {
  const releaseLock = acquireWorkerLock();
  if (!releaseLock) {
    return { schema: 'izakhono.agent-worker/v1', status: 'waiting', reason: 'agent-worker-lock-held', progressed: 0, plans: [] };
  }

  try {
    const state = readJson(statePath, { schema: 'izakhono.agent-state/v1', plans: {} });
    const queue = readJson(queuePath, { schema: 'izakhono.agent-queue/v1', items: [] });
    let progressed = 0;

    for (const item of queue.items.filter((entry) => ['queued', 'running', 'waiting', 'awaiting_approval'].includes(entry.status))) {
      const plan = state.plans[item.planId];
      if (!plan || plan.status === 'completed' || plan.status === 'blocked') continue;

      if (plan.approvalRequired && !plan.approved) {
        item.status = 'awaiting_approval';
        plan.status = 'awaiting_approval';
        continue;
      }
      if (item.status === 'awaiting_approval') item.status = 'queued';

      if (item.status === 'waiting' || plan.status === 'waiting') {
        for (const step of plan.steps) {
          if (step.status === 'waiting') {
            step.status = 'queued';
            delete step.reason;
          }
        }
        plan.status = 'queued';
        item.status = 'queued';
      }

      if (item.status === 'running' || plan.status === 'running') {
        let unsafeRecovery = false;
        for (const step of plan.steps.filter((candidate) => candidate.status === 'running')) {
          if (SAFE_RECOVERY_ACTIONS.has(step.action)) {
            step.status = 'queued';
            step.recoveredAt = new Date().toISOString();
            step.recoveryReason = 'retry-safe-step-after-worker-interruption';
          } else {
            step.status = 'failed';
            step.reason = 'manual-review-required-after-worker-interruption';
            unsafeRecovery = true;
          }
        }
        if (unsafeRecovery) {
          plan.status = 'blocked';
          item.status = 'blocked';
          continue;
        }
        plan.status = 'queued';
        item.status = 'queued';
      }

      const maxStepsPerPlan = Math.max(1, Number(process.env.IZAKHONO_AGENT_MAX_STEPS_PER_RUN || 25));
      let stepsThisPlan = 0;
      plan.status = 'running';
      item.status = 'running';

      while (stepsThisPlan < maxStepsPerPlan) {
        const step = nextReadyStep(plan);
        if (!step) break;

        step.status = 'running';
        step.startedAt = new Date().toISOString();
        const result = await execute(step, plan);
        applyResult(step, result);
        progressed += 1;
        stepsThisPlan += 1;

        if (step.status === 'failed') {
          plan.status = 'blocked';
          item.status = 'blocked';
          break;
        }
        if (step.status === 'waiting') {
          plan.status = 'waiting';
          item.status = 'waiting';
          break;
        }
      }

      if (plan.status !== 'blocked' && plan.status !== 'waiting') {
        const remaining = plan.steps.some((candidate) => candidate.status !== 'completed');
        if (!remaining) {
          plan.status = 'completed';
          item.status = 'completed';
          plan.completedAt = new Date().toISOString();
        } else {
          plan.status = 'queued';
          item.status = 'queued';
        }
      }
    }

    writeJson(statePath, state);
    writeJson(queuePath, queue);
    const plans = Object.values(state.plans).map((plan) => ({ planId: plan.planId, status: plan.status }));
    const waiting = plans.some((plan) => plan.status === 'waiting' || plan.status === 'awaiting_approval');
    const queued = plans.some((plan) => plan.status === 'queued' || plan.status === 'running');
    return {
      schema: 'izakhono.agent-worker/v1',
      status: progressed ? 'progressed' : waiting ? 'waiting' : queued ? 'queued' : 'idle',
      progressed,
      plans,
    };
  } finally {
    releaseLock();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAgentWorker().then((result) => console.log(JSON.stringify(result, null, 2)));
}
