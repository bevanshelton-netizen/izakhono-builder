import type { WorkerSpec } from './workers';

export type WorkerExecutionResult = {
  workerId: string;
  handlerVersion: string;
  status: 'executed';
  output: Record<string, unknown>;
  evidence: {
    kind: 'deterministic-worker-execution';
    verified: false;
    executedAt: string;
    inputDigest: string;
  };
};

type Handler = (input: unknown, worker: WorkerSpec) => Record<string, unknown>;

const objectInput = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('worker input must be a JSON object');
  }
  return input as Record<string, unknown>;
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
};

const handlers: Record<string, Handler> = {
  'portfolio-orchestrator': (input) => {
    const data = objectInput(input);
    const goal = text(data.goal, 'goal');
    const raw = Array.isArray(data.workstreams) ? data.workstreams : [];
    if (raw.length > 20) throw new Error('workstreams cannot exceed 20 items');
    const workstreams = raw.map((item, index) => {
      const title = text(item, `workstreams[${index}]`);
      return { id: `step-${index + 1}`, title, status: 'planned', dependsOn: index ? [`step-${index}`] : [] };
    });
    if (!workstreams.length) workstreams.push({ id: 'step-1', title: 'Define scope, deliverables and acceptance criteria', status: 'planned', dependsOn: [] });
    return { goal, planStatus: 'draft', workstreams, requiresReview: true };
  },
  'task-dispatcher': (input) => {
    const data = objectInput(input);
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    if (candidates.length > 100) throw new Error('candidates cannot exceed 100 items');
    const eligible: Record<string, unknown>[] = [];
    const withheld: Record<string, unknown>[] = [];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('each candidate must be an object');
      const item = candidate as Record<string, unknown>;
      const safe = typeof item.id === 'string' && typeof item.workerId === 'string'
        && item.status === 'queued' && item.risk !== 'high'
        && !item.humanGate && item.dependenciesReady === true;
      (safe ? eligible : withheld).push({ id: item.id ?? null, workerId: item.workerId ?? null, reason: safe ? 'eligible' : 'approval_dependency_or_state_gate' });
    }
    return { eligible, withheld, dispatchesPerformed: 0, note: 'Planning only; no jobs were dispatched by this handler.' };
  },
  'evidence-collector': (input) => {
    const data = objectInput(input);
    const entries = Array.isArray(data.evidence) ? data.evidence : [];
    if (!entries.length) throw new Error('evidence must contain at least one item');
    if (entries.length > 100) throw new Error('evidence cannot exceed 100 items');
    const collected = entries.map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`evidence[${index}] must be an object`);
      const item = entry as Record<string, unknown>;
      const id = text(item.id, `evidence[${index}].id`);
      const kind = text(item.kind, `evidence[${index}].kind`);
      const source = text(item.source, `evidence[${index}].source`);
      const observedAt = text(item.observedAt, `evidence[${index}].observedAt`);
      return { id, kind, source, observedAt, ...(typeof item.sha256 === 'string' ? { sha256: item.sha256 } : {}) };
    });
    return { collected, count: collected.length, verificationStatus: 'unverified', note: 'Collection does not establish authenticity or independently verify the evidence.' };
  },
};

export function hasWorkerHandler(workerId: string): boolean {
  return Object.prototype.hasOwnProperty.call(handlers, workerId);
}

export function executableWorkerIds(): string[] {
  return Object.keys(handlers).sort();
}

export async function executeWorker(worker: WorkerSpec, input: unknown): Promise<WorkerExecutionResult> {
  const handler = handlers[worker.id];
  if (!handler) throw new Error(`no executable handler registered for worker ${worker.id}`);
  const output = handler(input, worker);
  const serialized = JSON.stringify(input);
  const digestBytes = new TextEncoder().encode(serialized);
  const digest = await crypto.subtle.digest('SHA-256', digestBytes);
  const inputDigest = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return {
    workerId: worker.id,
    handlerVersion: '1.0.0',
    status: 'executed',
    output,
    evidence: { kind: 'deterministic-worker-execution', verified: false, executedAt: new Date().toISOString(), inputDigest },
  };
}
