import { DECISIONS, evaluateScenario } from './scenario-runner.mjs';

const API_VERSION = '1.0';
const MAX_AMOUNT = 1_000_000_000;

function fail(code, message, details = {}) {
  return { apiVersion: API_VERSION, ok: false, error: { code, message, details }, safety: { sandboxOnly: true, liveMoneyMovement: false } };
}

function validateRequest(request) {
  if (!request || typeof request !== 'object') return fail('INVALID_REQUEST', 'Request must be an object.');
  if (!request.requestId || typeof request.requestId !== 'string') return fail('MISSING_REQUEST_ID', 'requestId is required.');
  if (!request.subjectId || typeof request.subjectId !== 'string') return fail('MISSING_SUBJECT_ID', 'subjectId is required.');
  if (!request.transaction || typeof request.transaction !== 'object') return fail('MISSING_TRANSACTION', 'transaction context is required.');
  const amount = request.transaction.amount;
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return fail('INVALID_AMOUNT', 'transaction.amount must be a finite non-negative value within the supported bound.');
  if (!request.transaction.currency || typeof request.transaction.currency !== 'string') return fail('MISSING_CURRENCY', 'transaction.currency is required.');
  if (!request.signals || typeof request.signals !== 'object') return fail('MISSING_SIGNALS', 'signals are required.');
  return null;
}

function toScenario(request) {
  return { id: request.requestId, signals: request.signals };
}

function decide(request) {
  const validation = validateRequest(request);
  if (validation) return validation;
  const result = evaluateScenario(toScenario(request));
  const auditId = `frt_${request.requestId}`;
  const response = {
    apiVersion: API_VERSION,
    ok: true,
    requestId: request.requestId,
    auditId,
    decision: result.decision,
    riskScore: result.score,
    reasonCodes: result.reasons,
    policyVersion: request.policyVersion ?? 'fortress-default-v1',
    safety: { sandboxOnly: true, liveMoneyMovement: false },
    actions: result.decision === 'ALLOW' ? ['PROCEED_WITH_MONITORING'] : ['APPLY_PROVIDER_OR_INSTITUTION_CONTROL'],
    audit: { required: true, auditId },
    telemetry: { eventType: 'FORTRESS_DECISION', subjectId: request.subjectId, transactionId: request.transaction.id ?? null }
  };
  if (!DECISIONS.has(response.decision)) return fail('UNDEFINED_DECISION', 'Decision engine returned an unsupported decision.');
  return response;
}

function createDecisionEvent(response) {
  if (!response?.ok) return null;
  return {
    auditId: response.auditId,
    eventType: 'FORTRESS_DECISION',
    decision: response.decision,
    riskScore: response.riskScore,
    reasonCodes: [...response.reasonCodes],
    policyVersion: response.policyVersion,
    sandboxOnly: true,
    liveMoneyMovement: false,
    createdAt: new Date().toISOString()
  };
}

export { API_VERSION, validateRequest, decide, createDecisionEvent, DECISIONS };
