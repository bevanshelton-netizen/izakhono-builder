import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'autonomy', 'engine-manifest.json');
const statePath = path.join(root, 'autonomy', 'state.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { version: 1, tasks: {}, history: [] };

const now = new Date().toISOString();
const taskMap = new Map(manifest.queue.map(task => [task.id, task]));

function taskState(id) {
  return state.tasks[id] ?? { status: 'queued', attempts: 0 };
}

function ready(task) {
  return task.dependsOn.every(id => taskState(id).status === 'completed');
}

function transition(task, status, extra = {}) {
  const previous = taskState(task.id);
  state.tasks[task.id] = {
    ...previous,
    ...extra,
    status,
    updatedAt: now
  };
  state.history.push({ at: now, task: task.id, from: previous.status, to: status, ...extra });
}

function evidenceFor(task) {
  return (task.evidence ?? []).map(name => ({ name, status: 'pending' }));
}

function selectNext() {
  return manifest.queue.find(task => {
    const current = taskState(task.id);
    return current.status !== 'completed' && current.status !== 'blocked' && ready(task);
  });
}

const next = selectNext();
if (!next) {
  const blocked = manifest.queue.filter(task => taskState(task.id).status === 'blocked');
  console.log(JSON.stringify({ mode: manifest.mode, status: blocked.length ? 'blocked' : 'complete', blocked: blocked.map(t => t.id) }, null, 2));
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
  process.exit(0);
}

const current = taskState(next.id);
if (current.attempts >= manifest.policy.maxRetries) {
  transition(next, 'blocked', { reason: 'retry-budget-exhausted' });
} else if (next.ownerGate) {
  transition(next, 'waiting_owner', {
    ownerGate: next.ownerGate,
    reason: 'external-capability-required',
    evidence: evidenceFor(next)
  });
} else {
  transition(next, 'running', { attempts: current.attempts + 1, action: next.action, adapter: next.adapter });
  // The deterministic runner does not fake execution. Adapter workers consume this state.
  transition(next, 'awaiting_adapter', { evidence: evidenceFor(next) });
}

fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
console.log(JSON.stringify({
  mode: manifest.mode,
  selected: next.id,
  stage: next.stage,
  adapter: next.adapter,
  action: next.action,
  status: state.tasks[next.id].status,
  message: 'Next task selected automatically; adapter execution/evidence gate required.'
}, null, 2));
