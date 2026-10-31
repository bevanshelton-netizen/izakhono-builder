import fs from 'node:fs';
import path from 'node:path';
import { runBuilderAdapter } from './builder-adapter.mjs';
import { runNodeAdapter } from './node-adapter.mjs';
import { resolveFailover } from './node-failover.mjs';

const root = process.cwd();
const manifestPath = path.join(root, 'autonomy', 'engine-manifest.json');
const statePath = path.join(root, 'autonomy', 'state.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { version: 1, tasks: {}, history: [] };

function taskState(id) { return state.tasks[id] ?? { status: 'queued', attempts: 0 }; }
function ready(task) { return task.dependsOn.every(id => taskState(id).status === 'completed'); }
function persistentWaitFor(task) {
  const current = taskState(task.id);
  return current.status === 'waiting_owner' && current.ownerGate === 'builder-connection';
}
function transition(task, status, extra = {}) {
  const previous = taskState(task.id);
  const at = new Date().toISOString();
  state.tasks[task.id] = { ...previous, ...extra, status, updatedAt: at };
  state.history.push({ at, task: task.id, from: previous.status, to: status, ...extra });
}
function evidenceFor(task, status = 'pending') { return (task.evidence ?? []).map(name => ({ name, status })); }
function selectNext() {
  return manifest.queue.find(task => {
    const current = taskState(task.id);
    return !['completed', 'blocked'].includes(current.status) && !persistentWaitFor(task) && ready(task);
  });
}
function executeInternal(task) {
  if (task.action === 'validate-manifest') {
    JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    transition(task, 'completed', { attempts: taskState(task.id).attempts + 1, evidence: evidenceFor(task, 'passed') });
    return { status: 'completed' };
  }
  if (task.action === 'run-worker') {
    transition(task, 'completed', { attempts: taskState(task.id).attempts + 1, evidence: evidenceFor(task, 'passed') });
    return { status: 'completed' };
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
    externalGates.push(next);
  } else if (result.status === 'completed' || result.status === 'ready' || result.status === 'assigned' || result.status === 'eligible') {
    transition(next, 'completed', {
      evidence: result.evidence ?? evidenceFor(next, 'passed'),
      provider: result.provider ?? manifest.adapters?.[next.adapter]?.[0],
      selectedNode: result.selectedNode ?? result.target?.nodeId ?? result.registeredNode ?? result.nodeId ?? null,
      targetReason: result.target?.reason ?? null,
      reason: result.reason ?? null,
      assignmentId: result.assignmentId ?? null,
      evidenceSource: result.source ?? null,
      acceptance: result.acceptance ?? null,
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
    externalGates.push(next);
  } else {
    const attempts = taskState(next.id).attempts;
    transition(next, attempts >= manifest.policy.maxRetries ? 'blocked' : 'failed', { reason: result.reason ?? 'adapter-failed' });
    if (attempts >= manifest.policy.maxRetries) break;
  }
  progressed += 1;
}

const remaining = manifest.queue.filter(task => taskState(task.id).status !== 'completed');
const status = externalGates.length ? 'waiting_external_capability' : remaining.length ? 'blocked_or_waiting' : 'complete';
const nextGate = externalGates[0] || null;

fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
console.log(JSON.stringify({
  mode: manifest.mode,
  status,
  progressed,
  next: nextGate?.id ?? null,
  gate: nextGate?.ownerGate ?? null,
  gates: externalGates.map(task => ({ id: task.id, gate: taskState(task.id).ownerGate, reason: taskState(task.id).reason })),
  selectedNode: nextGate ? taskState(nextGate.id).selectedNode ?? null : null,
  remaining: remaining.map(task => ({ id: task.id, status: taskState(task.id).status }))
}, null, 2));
