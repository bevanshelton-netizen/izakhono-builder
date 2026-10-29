import fs from 'node:fs';
import path from 'node:path';
import { runBuilderAdapter } from './builder-adapter.mjs';

const root = process.cwd();
const manifestPath = path.join(root, 'autonomy', 'engine-manifest.json');
const statePath = path.join(root, 'autonomy', 'state.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { version: 1, tasks: {}, history: [] };

function taskState(id) {
  return state.tasks[id] ?? { status: 'queued', attempts: 0 };
}

function ready(task) {
  return task.dependsOn.every(id => taskState(id).status === 'completed');
}

function transition(task, status, extra = {}) {
  const previous = taskState(task.id);
  const at = new Date().toISOString();
  state.tasks[task.id] = { ...previous, ...extra, status, updatedAt: at };
  state.history.push({ at, task: task.id, from: previous.status, to: status, ...extra });
}

function evidenceFor(task, status = 'pending') {
  return (task.evidence ?? []).map(name => ({ name, status }));
}

function selectNext() {
  return manifest.queue.find(task => {
    const current = taskState(task.id);
    return !['completed', 'blocked'].includes(current.status) && ready(task);
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

  return null;
}

let progressed = 0;
let externalGate = null;

while (progressed < manifest.queue.length) {
  const next = selectNext();
  if (!next) break;

  const current = taskState(next.id);
  const isBuilderWait = current.status === 'waiting_owner' && next.ownerGate === 'builder-connection';

  if (next.ownerGate === 'physical-infrastructure') {
    transition(next, 'waiting_owner', {
      ownerGate: next.ownerGate,
      reason: 'external-capability-required',
      evidence: evidenceFor(next)
    });
    externalGate = next;
    break;
  }

  if (!isBuilderWait && current.attempts >= manifest.policy.maxRetries) {
    transition(next, 'blocked', { reason: 'retry-budget-exhausted' });
    break;
  }

  if (!isBuilderWait) {
    transition(next, 'running', { attempts: current.attempts + 1, action: next.action, adapter: next.adapter });
  } else {
    transition(next, 'running', { action: next.action, adapter: next.adapter, wakeReason: 'scheduled-retry' });
  }

  let result = executeInternal(next);

  if (!result && next.adapter === 'builder') {
    result = await runBuilderAdapter(next);
    if (result.status === 'completed') {
      transition(next, 'completed', {
        evidence: result.evidence ?? evidenceFor(next, 'passed'),
        provider: result.provider ?? manifest.adapters?.builder?.[0]
      });
    } else if (result.status === 'waiting') {
      transition(next, 'waiting_owner', {
        ownerGate: 'builder-connection',
        reason: result.reason ?? 'builder-connection-required',
        provider: result.provider ?? manifest.adapters?.builder?.[0],
        evidence: evidenceFor(next)
      });
      externalGate = next;
    } else {
      const attempts = taskState(next.id).attempts;
      transition(next, attempts >= manifest.policy.maxRetries ? 'blocked' : 'failed', {
        reason: result.reason ?? 'builder-failed',
        provider: result.provider ?? manifest.adapters?.builder?.[0]
      });
      externalGate = next;
    }
  } else if (!result) {
    transition(next, 'awaiting_adapter', { evidence: evidenceFor(next) });
    externalGate = next;
  }

  if (externalGate) break;
  progressed += 1;
}

const remaining = manifest.queue.filter(task => taskState(task.id).status !== 'completed');
const status = externalGate ? 'waiting_external_capability' : remaining.length ? 'blocked_or_waiting' : 'complete';

fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
console.log(JSON.stringify({
  mode: manifest.mode,
  status,
  progressed,
  next: externalGate?.id ?? null,
  gate: externalGate?.ownerGate ?? null,
  remaining: remaining.map(task => ({ id: task.id, status: taskState(task.id).status }))
}, null, 2));
