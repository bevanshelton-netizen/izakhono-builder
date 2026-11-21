import fs from 'node:fs';
import path from 'node:path';
import { runBuilderAdapter } from './builder-adapter.mjs';
import { runNodeAdapter } from './node-adapter.mjs';
import { resolveFailover } from './node-failover.mjs';
import { runAgentWorker } from './ai-agent-worker.mjs';
import { classifyAgentWorkerResult } from './worker-result.mjs';

const root = process.cwd();
const manifestPath = path.join(root, 'autonomy', 'engine-manifest.json');
const statePath = path.join(root, 'autonomy', 'state.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { version: 1, tasks: {}, history: [] };

const hasPersistentAgentStorage = Boolean(
  process.env.IZAKHONO_NODE_DATA_DIR ||
  (process.env.IZAKHONO_AGENT_STATE_PATH && process.env.IZAKHONO_AGENT_QUEUE_PATH)
);
let agentWorkerResult = null;
let agentWorkerError = null;
if (process.env.GITHUB_ACTIONS === 'true' && !hasPersistentAgentStorage) {
  agentWorkerResult = {
    status: 'waiting',
    reason: 'persistent-owned-node-agent-storage-not-configured',
    ownerGate: 'owned-node-runtime',
    progressed: 0,
    plans: [],
  };
} else {
  try {
    agentWorkerResult = await runAgentWorker();
  } catch (error) {
    agentWorkerError = error instanceof Error ? error.message : String(error);
    agentWorkerResult = { status: 'failed', reason: 'agent-worker-execution-failed', progressed: 0, plans: [] };
  }
}

function taskState(id) { return state.tasks[id] ?? { status: 'queued', attempts: 0 }; }
function ready(task) { return task.dependsOn.every(id => taskState(id).status === 'completed'); }
function persistentWaitFor(task) {
  const current = taskState(task.id);
  if (current.status === 'waiting_owner' && current.ownerGate === 'builder-connection') {
    state.tasks[task.id] = {
      ...current,
      status: 'queued',
      ownerGate: null,
      reason: 'legacy-builder-connection-cleared-native-builder-first',
      updatedAt: new Date().toISOString(),
    };
    return false;
  }
  return false;
}
function transition(task, status, extra = {}) {
  const previous = taskState(task.id);
  const at = new Date().toISOString();
  state.tasks[task.id] = { ...previous, ...extra, status, updatedAt: at };
  state.history.push({ at, task: task.id, from: previous.status, to: status, ...extra });
}
function evidenceFor(task, status = 'pending') { return (task.evidence ?? []).map(name => ({ name, status })); }
const deferredThisRun = new Set();
function selectNext() {
  return manifest.queue.find(task => {
    const current = taskState(task.id);
    return !['completed', 'blocked'].includes(current.status) && !deferredThisRun.has(task.id) && !persistentWaitFor(task) && ready(task);
  });
}
function executeInternal(task) {
  if (task.action === 'validate-manifest') {
    JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    transition(task, 'completed', { attempts: taskState(task.id).attempts + 1, evidence: evidenceFor(task, 'passed') });
    return { status: 'completed' };
  }
  if (task.action === 'run-worker') {
    if (agentWorkerError) {
      return { status: 'failed', reason: agentWorkerError, evidence: [{ name: 'agent-worker-invoked', status: 'failed' }] };
    }
    if (agentWorkerResult?.ownerGate) {
      return {
        status: 'waiting',
        ownerGate: agentWorkerResult.ownerGate,
        reason: agentWorkerResult.reason,
        evidence: [{ name: 'durable-agent-storage', status: 'pending' }],
      };
    }
    const outcome = classifyAgentWorkerResult(agentWorkerResult);
    if (outcome.status === 'failed') {
      return {
        status: 'failed',
        reason: outcome.reason,
        workerResult: agentWorkerResult,
        evidence: [{ name: 'agent-worker-invoked', status: 'passed' }, { name: 'agent-work-completed', status: 'failed' }],
      };
    }
    if (outcome.status === 'waiting') {
      return {
        status: 'waiting',
        reason: outcome.reason,
        workerResult: agentWorkerResult,
        evidence: [{ name: 'agent-worker-invoked', status: 'passed' }, { name: 'agent-work-completed', status: 'pending' }],
      };
    }
    return {
      status: 'completed',
      workerResult: agentWorkerResult,
      evidence: [
        { name: 'agent-worker-invoked', status: 'passed' },
        { name: 'agent-queue-inspected', status: 'passed' },
        { name: 'agent-work-completed', status: 'passed' },
      ],
    };
  }
  if (task.action === 'node-failover') {
    const result = resolveFailover(task.requirements ?? {});
    if (result.status === 'not_required') return { status: 'completed', evidence: evidenceFor(task, 'not_required'), reason: result.reason };
    if (result.status === 'ready') return { status: 'completed', selectedNode: result.replacementNodeId, target: result.target, evidence: evidenceFor(task, 'passed'), source: 'owned-node-control-plane' };
    return { status: 'waiting', reason: result.reason, selectedNode: null, target: result.target, evidence: evidenceFor(task), source: 'owned-node-control-plane' };
  }
  return null;
}

let progressed = 0;
const externalGates = [];

while (progressed < manifest.queue.length) {
  const next = selectNext();
  if (!next) break;
  const current = taskState(next.id);
  transition(next, 'running', { attempts: current.attempts + 1, action: next.action, adapter: next.adapter });

  let result = executeInternal(next);
  if (!result && next.adapter === 'builder') result = await runBuilderAdapter(next);

  const nodeActions = ['node-discovery', 'software-node-instantiation', 'node-heartbeat', 'node-evidence', 'node-target', 'node-readiness', 'workload-schedule', 'kora-workload-execute', 'kora-routing-acceptance'];
  if (!result && next.adapter === 'deploy' && nodeActions.includes(next.action)) {
    const priorTarget = ['node-readiness', 'kora-workload-execute', 'kora-routing-acceptance'].includes(next.action)
      ? taskState('node-target-selection').selectedNode
      : null;
    result = await runNodeAdapter(next.action, {
      taskId: next.id,
      taskTitle: next.title,
      evidenceRequired: next.evidence ?? [],
      requirements: next.requirements ?? {},
      selectedNode: priorTarget || undefined,
      workload: next.workload || undefined,
    });
  }

  if (!result) {
    transition(next, 'awaiting_adapter', { evidence: evidenceFor(next) });
    deferredThisRun.add(next.id);
    externalGates.push(next);
  } else if (['completed', 'ready', 'assigned', 'eligible', 'instantiated'].includes(result.status)) {
    transition(next, 'completed', {
      evidence: result.evidence ?? evidenceFor(next, 'passed'),
      provider: result.provider ?? manifest.adapters?.[next.adapter]?.[0],
      selectedNode: result.selectedNode ?? result.target?.nodeId ?? result.registeredNode ?? result.nodeId ?? null,
      targetReason: result.target?.reason ?? null,
      reason: result.reason ?? null,
      assignmentId: result.assignmentId ?? null,
      evidenceSource: result.source ?? null,
      acceptance: result.acceptance ?? null,
      workerResult: result.workerResult ?? null,
    });
  } else if (result.status === 'waiting') {
    const ownerGate = next.ownerGate ?? result.ownerGate ?? null;
    transition(next, ownerGate ? 'waiting_owner' : 'waiting', {
      ownerGate,
      reason: result.reason ?? 'capability-required',
      provider: result.provider ?? manifest.adapters?.[next.adapter]?.[0],
      selectedNode: result.selectedNode ?? result.target?.nodeId ?? result.registeredNode ?? result.nodeId ?? null,
      evidence: result.evidence ?? evidenceFor(next),
      evidenceSource: result.source ?? null,
      acceptance: result.acceptance ?? null,
    });
    deferredThisRun.add(next.id);
    externalGates.push(next);
  } else {
    const attempts = taskState(next.id).attempts;
    transition(next, attempts >= manifest.policy.maxRetries ? 'blocked' : 'failed', { reason: result.reason ?? 'adapter-failed' });
    if (attempts >= manifest.policy.maxRetries) break;
  }
  progressed += 1;
}

const remaining = manifest.queue.filter(task => taskState(task.id).status !== 'completed');
const workerPlans = agentWorkerResult?.plans ?? [];
const workerBlocked = workerPlans.some(plan => ['blocked', 'awaiting_approval', 'waiting'].includes(plan.status));
const workerQueued = workerPlans.some(plan => ['queued', 'running'].includes(plan.status));
const status = agentWorkerError
  ? 'worker_failed'
  : workerBlocked
    ? 'blocked_or_waiting'
    : workerQueued
      ? 'in_progress'
      : externalGates.length
        ? 'waiting_external_capability'
        : remaining.length
          ? 'blocked_or_waiting'
          : 'complete';
const nextGate = externalGates[0] || null;

const temporaryStatePath = `${statePath}.tmp-${process.pid}`;
fs.writeFileSync(temporaryStatePath, JSON.stringify(state, null, 2) + '\n');
fs.renameSync(temporaryStatePath, statePath);
console.log(JSON.stringify({
  mode: manifest.mode,
  status,
  worker: agentWorkerResult,
  workerError: agentWorkerError,
  progressed,
  next: nextGate?.id ?? null,
  gate: nextGate?.ownerGate ?? null,
  gates: externalGates.map(task => ({ id: task.id, gate: taskState(task.id).ownerGate, reason: taskState(task.id).reason })),
  selectedNode: nextGate ? taskState(nextGate.id).selectedNode ?? null : null,
  remaining: remaining.map(task => ({ id: task.id, status: taskState(task.id).status }))
}, null, 2));
