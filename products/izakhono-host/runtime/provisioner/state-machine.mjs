export const PROVISIONING_STATES = Object.freeze([
  'PLANNED',
  'PAYMENT_VERIFIED',
  'DOMAIN_READY',
  'DNS_READY',
  'SITE_READY',
  'TLS_READY',
  'MAIL_READY',
  'INTEGRATIONS_READY',
  'ACCEPTANCE_PENDING',
  'LIVE',
  'FAILED',
  'PAUSED'
]);

export const TERMINAL_STATES = new Set(['LIVE', 'FAILED', 'PAUSED']);

const DEPENDENCIES = Object.freeze({
  PLANNED: [],
  PAYMENT_VERIFIED: ['PLANNED'],
  DOMAIN_READY: ['PAYMENT_VERIFIED'],
  DNS_READY: ['DOMAIN_READY'],
  SITE_READY: ['DNS_READY'],
  TLS_READY: ['SITE_READY'],
  MAIL_READY: ['TLS_READY'],
  INTEGRATIONS_READY: ['MAIL_READY'],
  ACCEPTANCE_PENDING: ['INTEGRATIONS_READY'],
  LIVE: ['ACCEPTANCE_PENDING'],
  FAILED: [],
  PAUSED: []
});

export const MAX_ATTEMPTS = 5;
export const RETRY_DELAYS_MS = Object.freeze([1000, 5000, 30000, 120000, 600000]);

export function dependenciesFor(state) {
  return [...(DEPENDENCIES[state] || [])];
}

export function canEnter(current, next) {
  if (!PROVISIONING_STATES.includes(next)) return false;
  if (next === 'FAILED' || next === 'PAUSED') return true;
  if (current === next) return true;
  return dependenciesFor(next).includes(current);
}

export function retryDelay(attempt) {
  const index = Math.max(0, Math.min(Number(attempt || 1) - 1, RETRY_DELAYS_MS.length - 1));
  return RETRY_DELAYS_MS[index];
}

export function newProvisioningRecord({ id, customerId = null, domain, idempotencyKey }) {
  if (!id || !domain || !idempotencyKey) throw new Error('id, domain and idempotencyKey are required');
  const now = new Date().toISOString();
  return {
    id,
    customer_id: customerId,
    domain: String(domain).toLowerCase(),
    idempotency_key: idempotencyKey,
    state: 'PLANNED',
    attempts: 0,
    public_live: false,
    created_at: now,
    updated_at: now,
    accepted_at: null,
    failure: null,
    audit: [{ at: now, event: 'PROVISIONING_CREATED', state: 'PLANNED' }]
  };
}

export function transition(record, next, metadata = {}) {
  if (!canEnter(record.state, next)) {
    throw new Error(`Invalid provisioning transition: ${record.state} -> ${next}`);
  }
  const now = new Date().toISOString();
  const updated = {
    ...record,
    state: next,
    updated_at: now,
    public_live: next === 'LIVE',
    failure: next === 'FAILED' ? (metadata.error || record.failure || 'Provisioning failed') : null,
    audit: [...(record.audit || []), { at: now, event: `STATE_${next}`, state: next, metadata }]
  };
  if (next === 'LIVE') updated.accepted_at = metadata.accepted_at || now;
  return updated;
}

export function recordAttempt(record) {
  const attempts = Number(record.attempts || 0) + 1;
  if (attempts > MAX_ATTEMPTS) throw new Error('Provisioning retry limit reached');
  const now = new Date().toISOString();
  return {
    ...record,
    attempts,
    updated_at: now,
    audit: [...(record.audit || []), { at: now, event: 'ATTEMPT', attempt: attempts }]
  };
}

export function acceptanceComplete(evidence = {}) {
  return evidence.https === true && evidence.dns === true && evidence.content === true && evidence.mail === true;
}

export function assertLiveEvidence(evidence = {}) {
  if (!acceptanceComplete(evidence)) {
    throw new Error('LIVE requires verified HTTPS, DNS, content and mail acceptance evidence');
  }
  return true;
}
