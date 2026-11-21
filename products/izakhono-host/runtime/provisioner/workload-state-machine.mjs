const STATES = Object.freeze([
  'REQUESTED', 'VALIDATING', 'PROVISIONING', 'IMPORTING_DATA',
  'STARTING', 'VERIFYING', 'READY', 'STOPPING', 'STOPPED',
  'BACKING_UP', 'BACKED_UP', 'RESTORING', 'REPLACING',
  'ROLLING_BACK', 'FAILED', 'PAUSED'
]);

const NEXT = Object.freeze({
  REQUESTED: ['VALIDATING', 'FAILED', 'PAUSED'],
  VALIDATING: ['PROVISIONING', 'FAILED', 'PAUSED'],
  PROVISIONING: ['IMPORTING_DATA', 'STARTING', 'FAILED', 'PAUSED'],
  IMPORTING_DATA: ['STARTING', 'FAILED', 'PAUSED'],
  STARTING: ['VERIFYING', 'FAILED', 'PAUSED'],
  VERIFYING: ['READY', 'FAILED', 'PAUSED'],
  READY: ['STOPPING', 'BACKING_UP', 'REPLACING', 'PAUSED'],
  STOPPING: ['STOPPED', 'FAILED'],
  STOPPED: ['STARTING', 'RESTORING', 'REPLACING', 'PAUSED'],
  BACKING_UP: ['BACKED_UP', 'FAILED'],
  BACKED_UP: ['READY', 'RESTORING', 'FAILED'],
  RESTORING: ['VERIFYING', 'FAILED'],
  REPLACING: ['PROVISIONING', 'ROLLING_BACK', 'FAILED'],
  ROLLING_BACK: ['VERIFYING', 'FAILED'],
  FAILED: ['VALIDATING', 'ROLLING_BACK', 'PAUSED'],
  PAUSED: ['VALIDATING', 'STOPPING']
});

const SHA256 = /^[a-f0-9]{64}$/i;
const ID = /^[a-z0-9][a-z0-9-]{2,62}$/;
const NODE = /^NODE[0-9]{2}$/;

export const WORKLOAD_STATES = STATES;
export const MAX_WORKLOAD_ATTEMPTS = 5;
export const WORKLOAD_RETRY_DELAYS_MS = Object.freeze([1000, 5000, 30000, 120000, 600000]);

export function validateWorkloadSpec(spec = {}) {
  if (!ID.test(String(spec.workloadId || ''))) throw new Error('workloadId must be a stable lowercase identifier');
  if (spec.workloadClass !== 'navigation-platform') throw new Error('workloadClass must be navigation-platform');
  if (!NODE.test(String(spec.logicalNodeId || ''))) throw new Error('logicalNodeId must be a logical NODE identity such as NODE01');
  if (!SHA256.test(String(spec.releaseDigest || ''))) throw new Error('releaseDigest must be a SHA-256 digest');
  if (typeof spec.healthPath !== 'string' || !/^\\/[A-Za-z0-9/_-]*$/.test(spec.healthPath) || spec.healthPath.startsWith('//')) {
    throw new Error('healthPath must be a safe absolute path without query, fragment or traversal segments');
  }
  if (typeof spec.internalPort !== 'number' || !Number.isInteger(spec.internalPort) || spec.internalPort < 1 || spec.internalPort > 65535) {
    throw new Error('internalPort must be a valid TCP port');
  }
  if (typeof spec.idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{12,200}$/.test(spec.idempotencyKey)) {
    throw new Error('idempotencyKey must contain 12-200 safe characters');
  }
  // Runtime target is deliberately an opaque HOST binding, not a physical machine identity.
  if (spec.runtimeTargetId !== undefined && (typeof spec.runtimeTargetId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(spec.runtimeTargetId))) {
    throw new Error('runtimeTargetId must be a safe opaque HOST runtime binding when supplied');
  }
  return true;
}

export function createWorkloadRecord(spec, { id, now = new Date().toISOString() } = {}) {
  validateWorkloadSpec(spec);
  if (!ID.test(String(id || ''))) throw new Error('A stable workload record id is required');
  return {
    id,
    workload_id: spec.workloadId,
    workload_class: spec.workloadClass,
    logical_node_id: spec.logicalNodeId,
    runtime_target_id: spec.runtimeTargetId || null,
    release_digest: spec.releaseDigest.toLowerCase(),
    health_path: spec.healthPath,
    internal_port: spec.internalPort,
    idempotency_key: spec.idempotencyKey,
    state: 'REQUESTED',
    attempts: 0,
    public_live: false,
    acceptance: { runtime: false, data: false, routing: false, search: false, tiles: false, persistence: false, backup_restore: false, https: false, dns: false },
    created_at: now,
    updated_at: now,
    audit: [{ at: now, event: 'WORKLOAD_REQUESTED', state: 'REQUESTED' }]
  };
}

export function transitionWorkload(record, next, metadata = {}, now = new Date().toISOString()) {
  if (!STATES.includes(next)) throw new Error(`Unknown workload state: ${next}`);
  if (!NEXT[record.state]?.includes(next)) throw new Error(`Invalid workload transition: ${record.state} -> ${next}`);
  const updated = {
    ...record,
    state: next,
    updated_at: now,
    public_live: false,
    audit: [...(record.audit || []), { at: now, event: `STATE_${next}`, state: next, metadata }]
  };
  if (next === 'READY') {
    const required = ['runtime', 'data', 'routing', 'search', 'tiles', 'persistence'];
    const evidence = metadata.acceptance || {};
    const missing = required.filter(key => evidence[key] !== true);
    if (missing.length) throw new Error(`READY requires verified evidence: ${missing.join(', ')}`);
    updated.acceptance = { ...record.acceptance, ...evidence };
    updated.ready_at = now;
  }
  if (next === 'FAILED') updated.failure = String(metadata.error || 'Workload operation failed');
  if (next === 'ROLLING_BACK' && metadata.ownerApproved !== true) {
    throw new Error('Rollback requires explicit owner approval');
  }
  return updated;
}

export function recordWorkloadAttempt(record, now = new Date().toISOString()) {
  const attempts = Number(record.attempts || 0) + 1;
  if (attempts > MAX_WORKLOAD_ATTEMPTS) throw new Error('Workload retry limit reached');
  return { ...record, attempts, updated_at: now,
    audit: [...(record.audit || []), { at: now, event: 'ATTEMPT', attempt: attempts }] };
}

export function workloadRetryDelay(attempt) {
  const index = Math.max(0, Math.min(Number(attempt || 1) - 1, WORKLOAD_RETRY_DELAYS_MS.length - 1));
  return WORKLOAD_RETRY_DELAYS_MS[index];
}

export function assertPublicActivation(record, evidence = {}) {
  const required = ['runtime', 'data', 'routing', 'search', 'tiles', 'persistence', 'backup_restore', 'https', 'dns'];
  const missing = required.filter(key => evidence[key] !== true);
  if (record.state !== 'READY' || missing.length) {
    throw new Error(`Public activation blocked; state=${record.state}; missing=${missing.join(', ')}`);
  }
  return { ...record, public_live: true, acceptance: { ...record.acceptance, ...evidence },
    public_live_at: new Date().toISOString(),
    audit: [...(record.audit || []), { at: new Date().toISOString(), event: 'PUBLIC_ACTIVATION_ACCEPTED' }] };
}
