const TERMINAL = new Set(['SUCCEEDED', 'ROLLED_BACK']);
const TRANSITIONS = {
  REQUESTED: ['PLANNED'],
  PLANNED: ['QUEUED', 'FAILED'],
  QUEUED: ['EXECUTING', 'FAILED'],
  EXECUTING: ['VERIFYING', 'FAILED'],
  VERIFYING: ['SUCCEEDED', 'FAILED', 'ROLLBACK_PENDING'],
  FAILED: ['ROLLBACK_PENDING'],
  ROLLBACK_PENDING: ['ROLLED_BACK', 'FAILED']
};

export function transition(current, next) {
  if (TERMINAL.has(current)) throw new Error(`terminal state: ${current}`);
  if (!(TRANSITIONS[current] || []).includes(next)) {
    throw new Error(`invalid transition: ${current} -> ${next}`);
  }
  return next;
}

export function command({ engine, action, tenantId, projectId, payload = {} }) {
  if (!engine || !action || !tenantId || !projectId) {
    throw new Error('engine, action, tenantId and projectId are required');
  }
  return {
    command_id: crypto.randomUUID(),
    engine,
    action,
    tenant_id: tenantId,
    project_id: projectId,
    payload,
    state: 'REQUESTED',
    created_at: new Date().toISOString()
  };
}

export function productionEvidence(result) {
  return Boolean(result?.endpoint && result?.health?.ok && result?.tls?.verified && result?.rollback?.recorded);
}
