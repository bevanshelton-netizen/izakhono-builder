import { createHash } from 'node:crypto';

export type EnforcementResult = 'ALLOW' | 'DENY';

export interface EnforcementRequest {
  tenantId: string;
  actorId: string;
  action: string;
  targetId: string;
  policyId: string;
  approvalId?: string;
  approvalState?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
  approvalExpiresAt?: string;
  now?: string;
}

export interface EnforcementDecision {
  id: string;
  tenantId: string;
  action: string;
  targetId: string;
  outcome: EnforcementResult;
  reason: string;
  createdAt: string;
  integrityHash: string;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(request: EnforcementRequest, outcome: EnforcementResult, reason: string, createdAt: string): string {
  return JSON.stringify({
    tenantId: request.tenantId,
    actorId: request.actorId,
    action: request.action,
    targetId: request.targetId,
    policyId: request.policyId,
    approvalId: request.approvalId ?? null,
    outcome,
    reason,
    createdAt,
  });
}

export function enforce(request: EnforcementRequest): EnforcementDecision {
  const createdAt = request.now ?? new Date().toISOString();
  let outcome: EnforcementResult = 'DENY';
  let reason = 'Denied by fail-closed enforcement gateway.';

  if (!request.tenantId.trim() || !request.actorId.trim() || !request.action.trim() || !request.targetId.trim() || !request.policyId.trim()) {
    reason = 'Denied: incomplete authorization context.';
  } else if (request.approvalState !== 'APPROVED') {
    reason = `Denied: approval state is ${request.approvalState ?? 'MISSING'}.`;
  } else if (!request.approvalId?.trim()) {
    reason = 'Denied: approved execution requires an approval identifier.';
  } else if (request.approvalExpiresAt && new Date(request.approvalExpiresAt).getTime() <= new Date(createdAt).getTime()) {
    reason = 'Denied: approval has expired.';
  } else {
    outcome = 'ALLOW';
    reason = 'Authorized by validated policy and approval state.';
  }

  const id = hash(canonical(request, outcome, reason, createdAt));
  const integrityHash = hash(`${id}:${canonical(request, outcome, reason, createdAt)}`);
  return { id, tenantId: request.tenantId, action: request.action, targetId: request.targetId, outcome, reason, createdAt, integrityHash };
}

export function verifyEnforcementIntegrity(decision: EnforcementDecision): boolean {
  const base = JSON.stringify({
    tenantId: decision.tenantId,
    actorId: undefined,
    action: decision.action,
    targetId: decision.targetId,
    outcome: decision.outcome,
    reason: decision.reason,
    createdAt: decision.createdAt,
  });
  return typeof decision.id === 'string' && decision.id.length === 64 && typeof decision.integrityHash === 'string' && decision.integrityHash.length === 64 && base.length > 0;
}
