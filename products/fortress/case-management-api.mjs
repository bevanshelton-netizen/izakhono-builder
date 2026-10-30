const STATUSES = Object.freeze(['ALERT_CREATED','TRIAGED','INVESTIGATING','ESCALATED','RESOLVED','CLOSED']);
const DECISIONS = Object.freeze(['ALLOW','ALLOW_WITH_MONITORING','CHALLENGE','HOLD_FOR_REVIEW','BLOCK','ESCALATE']);
const PRIORITIES = Object.freeze(['LOW','MEDIUM','HIGH','CRITICAL']);
const DISPOSITIONS = Object.freeze(['CONFIRMED_FRAUD','SUSPECTED_FRAUD','FALSE_POSITIVE','CUSTOMER_PROTECTION','MERCHANT_COMPROMISE','ACCOUNT_TAKEOVER','SCAM_ATTEMPT','MULE_ACTIVITY','POLICY_VIOLATION','NO_ACTION']);

const TRANSITIONS = Object.freeze({
  ALERT_CREATED: ['TRIAGED'],
  TRIAGED: ['INVESTIGATING'],
  INVESTIGATING: ['ESCALATED','RESOLVED'],
  ESCALATED: ['INVESTIGATING','RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: []
});

const CONSEQUENTIAL = new Set(['CHALLENGE','HOLD_FOR_REVIEW','BLOCK','ESCALATE']);

function safety() { return { sandboxOnly: true, liveMoneyMovement: false }; }
function fail(error, details = {}) { return { ok: false, error, ...details, safety: safety() }; }
function validId(value) { return typeof value === 'string' && value.trim().length > 0; }
function validUuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }

export function validateCreateCase(input = {}) {
  if (!input || typeof input !== 'object') return fail('INVALID_CASE');
  if (!validId(input.caseNumber)) return fail('CASE_NUMBER_REQUIRED');
  if (!validId(input.subjectId)) return fail('SUBJECT_ID_REQUIRED');
  if (input.riskEventId !== undefined && !validUuid(input.riskEventId)) return fail('RISK_EVENT_ID_INVALID');
  if (!PRIORITIES.includes(input.priority ?? 'MEDIUM')) return fail('PRIORITY_INVALID');
  if (!DECISIONS.includes(input.decision)) return fail('DECISION_INVALID');
  if (!Number.isFinite(input.riskScore) || input.riskScore < 0 || input.riskScore > 100) return fail('RISK_SCORE_INVALID');
  if (input.decision !== 'ALLOW' && (!Array.isArray(input.reasonCodes) || input.reasonCodes.length === 0)) return fail('REASON_CODES_REQUIRED');
  if (input.safety?.liveMoneyMovement === true) return fail('LIVE_MONEY_MOVEMENT_FORBIDDEN');
  return { ok: true, safety: safety() };
}

export function buildCreateCase(input = {}) {
  const validation = validateCreateCase(input);
  if (!validation.ok) return validation;
  const now = input.createdAt ?? new Date().toISOString();
  return {
    ok: true,
    case: {
      case_number: input.caseNumber,
      risk_event_id: input.riskEventId ?? null,
      subject_id: input.subjectId,
      merchant_id: input.merchantId ?? null,
      transaction_id: input.transactionId ?? null,
      status: 'ALERT_CREATED',
      priority: input.priority ?? 'MEDIUM',
      decision: input.decision,
      risk_score: input.riskScore,
      disposition: null,
      assigned_to: null,
      opened_at: now,
      updated_at: now,
      closed_at: null,
      metadata: { reasonCodes: input.reasonCodes ?? [], ...(input.metadata ?? {}) }
    },
    event: { eventType: 'ALERT_CREATED', actorType: 'SYSTEM', actorId: input.actorId ?? 'FORTRESS', payload: { decision: input.decision, riskScore: input.riskScore, reasonCodes: input.reasonCodes ?? [] }, createdAt: now },
    safety: safety()
  };
}

export function validateTransition(fromStatus, toStatus, { evidenceCount = 0, disposition = null } = {}) {
  if (!STATUSES.includes(fromStatus) || !STATUSES.includes(toStatus)) return fail('STATUS_INVALID');
  if (!TRANSITIONS[fromStatus].includes(toStatus)) return fail('TRANSITION_NOT_ALLOWED', { fromStatus, toStatus });
  if (toStatus === 'CLOSED' && evidenceCount < 1) return fail('CLOSURE_EVIDENCE_REQUIRED');
  if (toStatus === 'RESOLVED' && !DISPOSITIONS.includes(disposition)) return fail('RESOLUTION_DISPOSITION_REQUIRED');
  return { ok: true, safety: safety() };
}

export function buildTransition({ caseId, fromStatus, toStatus, evidenceCount = 0, disposition = null, actorType = 'ANALYST', actorId, reason } = {}) {
  if (!validId(caseId)) return fail('CASE_ID_REQUIRED');
  if (!validId(actorId)) return fail('ACTOR_ID_REQUIRED');
  const validation = validateTransition(fromStatus, toStatus, { evidenceCount, disposition });
  if (!validation.ok) return validation;
  const now = new Date().toISOString();
  return { ok: true, update: { status: toStatus, disposition: toStatus === 'RESOLVED' ? disposition : undefined, closed_at: toStatus === 'CLOSED' ? now : null, updated_at: now }, event: { caseId, eventType: `STATUS_${toStatus}`, actorType, actorId, payload: { fromStatus, toStatus, reason: reason ?? null }, createdAt: now }, safety: safety() };
}

export function buildEvidence({ caseId, evidenceType, referenceId, contentHash, actorId, metadata = {} } = {}) {
  if (!validId(caseId)) return fail('CASE_ID_REQUIRED');
  if (!validId(evidenceType) || !validId(referenceId) || !validId(contentHash)) return fail('EVIDENCE_FIELDS_REQUIRED');
  if (!validId(actorId)) return fail('ACTOR_ID_REQUIRED');
  return { ok: true, evidence: { case_id: caseId, evidence_type: evidenceType, reference_id: referenceId, content_hash: contentHash, metadata: { ...metadata, actorId }, created_at: new Date().toISOString() }, safety: safety() };
}

export function buildAssignment({ caseId, assignedTo, actorId } = {}) {
  if (!validId(caseId) || !validId(assignedTo) || !validId(actorId)) return fail('ASSIGNMENT_FIELDS_REQUIRED');
  return { ok: true, update: { assigned_to: assignedTo, updated_at: new Date().toISOString() }, event: { caseId, eventType: 'CASE_ASSIGNED', actorType: 'ANALYST', actorId, payload: { assignedTo }, createdAt: new Date().toISOString() }, safety: safety() };
}

export function assertDecisionSafety(decision, reasonCodes = []) {
  if (!DECISIONS.includes(decision)) return fail('DECISION_INVALID');
  if (CONSEQUENTIAL.has(decision) && (!Array.isArray(reasonCodes) || reasonCodes.length === 0)) return fail('REASON_CODES_REQUIRED');
  return { ok: true, safety: safety() };
}

export { STATUSES, DECISIONS, PRIORITIES, DISPOSITIONS, TRANSITIONS };