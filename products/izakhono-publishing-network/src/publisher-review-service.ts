/**
 * Private publisher review application service.
 *
 * Authentication is resolved from a live FORTRESS identity session. The
 * authorization port must then make a separate resource/action decision.
 * The persistence port must atomically commit case, immutable decision, audit
 * evidence and idempotency receipt. No production adapters are wired here.
 */
import {
  validateReviewAction,
  validateReviewCase,
  validateImmutableReviewDecision,
  type ImmutableReviewDecision,
  type PublisherReviewCase,
  type ReviewAction,
  type ReviewAuthorization,
  type ReviewCaseStatus,
  type ReviewDecisionKind,
  type ReviewTenantScope,
} from './publisher-review-queue-contracts';

export type FortressIdentityRole = 'OWNER' | 'SECURITY_ADMIN' | 'ANALYST' | 'VIEWER';
export interface VerifiedReviewSession {
  principalRef: string;
  tenant: ReviewTenantScope;
  role: FortressIdentityRole;
}
export interface ReviewSessionVerifier {
  /** Resolve a bearer/session credential through FORTRESS GET /api/fortress/session. */
  verifySession(sessionCredential: string): Promise<VerifiedReviewSession | null>;
}
export interface AuthorizationRequest {
  tenant: ReviewTenantScope;
  principalRef: string;
  identityRole: FortressIdentityRole;
  resourceRef: string;
  permission: string;
  purpose: 'publisher_review';
}
export interface AuthorizationDecision {
  allowed: boolean;
  decisionRef: string;
  principalRef: string;
  permission: string;
  policyVersion: string;
  decidedAt: string;
}
export interface ReviewAuthorizationPort {
  /** Must evaluate the current principal, tenant, resource and permission; role alone is not sufficient. */
  authorize(request: AuthorizationRequest): Promise<AuthorizationDecision>;
}
export interface ReviewAuditDraft {
  tenant: ReviewTenantScope;
  actorPrincipalRef: string;
  authorizationDecisionRef: string;
  action: ReviewDecisionKind;
  resourceRef: string;
  reasonCode: string;
  occurredAt: string;
  correlationRef: string;
}
export interface ReviewMutationCommit {
  tenant: ReviewTenantScope;
  caseId: string;
  expectedVersion: number;
  nextCase: PublisherReviewCase;
  decision: Omit<ImmutableReviewDecision, 'auditEventRef'>;
  audit: ReviewAuditDraft;
  idempotencyKey: string;
  requestFingerprint: string;
}
export type ReviewCommitResult =
  | { status: 'committed'; reviewCase: PublisherReviewCase; decision: ImmutableReviewDecision; replayed: false }
  | { status: 'replayed'; reviewCase: PublisherReviewCase; decision: ImmutableReviewDecision; replayed: true }
  | { status: 'conflict' };
export interface ReviewStore {
  getCase(tenant: ReviewTenantScope, caseId: string): Promise<PublisherReviewCase | null>;
  /** Must atomically compare version, write case + immutable decision + audit event + idempotency receipt. */
  commitMutation(input: ReviewMutationCommit): Promise<ReviewCommitResult>;
}
export interface ReviewServicePorts {
  sessions: ReviewSessionVerifier;
  authorization: ReviewAuthorizationPort;
  store: ReviewStore;
  now?: () => string;
}
export interface TransitionReviewCommand {
  sessionCredential: string;
  caseId: string;
  action: ReviewDecisionKind;
  reasonCode: string;
  reviewerNoteRef: string | null;
  expectedVersion: number;
  idempotencyKey: string;
  correlationRef: string;
}
export type ReviewServiceErrorCode =
  | 'REVIEW_SESSION_INVALID'
  | 'REVIEW_AUTHORIZATION_DENIED'
  | 'REVIEW_CASE_NOT_FOUND'
  | 'REVIEW_CASE_INVALID'
  | 'REVIEW_ACTION_INVALID'
  | 'REVIEW_VERSION_CONFLICT'
  | 'REVIEW_IDEMPOTENCY_KEY_REQUIRED'
  | 'REVIEW_AUTHORIZATION_RESPONSE_INVALID'
  | 'REVIEW_DECISION_INVALID';
export class ReviewServiceError extends Error {
  constructor(readonly code: ReviewServiceErrorCode, message = code) { super(message); this.name = 'ReviewServiceError'; }
}
const permissionByAction: Record<ReviewDecisionKind, string> = {
  approve: 'publishing:review:approve',
  reject: 'publishing:review:reject',
  request_evidence: 'publishing:review:request_evidence',
  return_to_queue: 'publishing:review:assign',
  close: 'publishing:review:close',
};
const targetByAction: Record<ReviewDecisionKind, ReviewCaseStatus> = {
  approve: 'approved', reject: 'rejected', request_evidence: 'awaiting_evidence',
  return_to_queue: 'open', close: 'closed',
};
const nonBlank = (value: string): boolean => typeof value === 'string' && value.trim().length > 0;
function sameTenant(a: ReviewTenantScope, b: ReviewTenantScope): boolean {
  return a.platformId === b.platformId && a.entityId === b.entityId;
}
async function fingerprint(command: TransitionReviewCommand, session: VerifiedReviewSession): Promise<string> {
  const canonical = JSON.stringify({
    tenant: { platformId: session.tenant.platformId, entityId: session.tenant.entityId },
    principalRef: session.principalRef,
    caseId: command.caseId,
    action: command.action,
    reasonCode: command.reasonCode,
    reviewerNoteRef: command.reviewerNoteRef,
    expectedVersion: command.expectedVersion,
    idempotencyKey: command.idempotencyKey,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export class PublisherReviewService {
  constructor(private readonly ports: ReviewServicePorts) {}
  async readCase(sessionCredential: string, caseId: string): Promise<PublisherReviewCase> {
    const session = await this.resolveSession(sessionCredential);
    const auth = await this.ports.authorization.authorize({
      tenant: session.tenant, principalRef: session.principalRef, identityRole: session.role,
      resourceRef: `publisher-review:${caseId}`, permission: 'publishing:review:read',
      purpose: 'publisher_review',
    });
    if (!auth.allowed) throw new ReviewServiceError('REVIEW_AUTHORIZATION_DENIED');
    if (!this.validAuthorization(auth, session.principalRef, 'publishing:review:read')) throw new ReviewServiceError('REVIEW_AUTHORIZATION_RESPONSE_INVALID');
    const record = await this.ports.store.getCase(session.tenant, caseId);
    if (!record || !sameTenant(record.tenant, session.tenant)) throw new ReviewServiceError('REVIEW_CASE_NOT_FOUND');
    const errors = validateReviewCase(record, this.clock());
    if (errors.length) throw new ReviewServiceError('REVIEW_CASE_INVALID', errors.join(','));
    return record;
  }
  async transition(command: TransitionReviewCommand): Promise<ReviewCommitResult> {
    if (!nonBlank(command.idempotencyKey) || command.idempotencyKey.length > 200) throw new ReviewServiceError('REVIEW_IDEMPOTENCY_KEY_REQUIRED');
    if (!nonBlank(command.caseId) || !nonBlank(command.correlationRef)) throw new ReviewServiceError('REVIEW_ACTION_INVALID');
    const session = await this.resolveSession(command.sessionCredential);
    const permission = permissionByAction[command.action];
    const authorization = await this.ports.authorization.authorize({
      tenant: session.tenant, principalRef: session.principalRef, identityRole: session.role,
      resourceRef: `publisher-review:${command.caseId}`, permission, purpose: 'publisher_review',
    });
    if (!authorization.allowed) throw new ReviewServiceError('REVIEW_AUTHORIZATION_DENIED');
    if (!this.validAuthorization(authorization, session.principalRef, permission)) throw new ReviewServiceError('REVIEW_AUTHORIZATION_RESPONSE_INVALID');
    // Authentication and resource authorization both precede case lookup to avoid existence leaks.
    const current = await this.ports.store.getCase(session.tenant, command.caseId);
    if (!current || !sameTenant(current.tenant, session.tenant)) throw new ReviewServiceError('REVIEW_CASE_NOT_FOUND');
    const now = this.clock();
    const caseErrors = validateReviewCase(current, now);
    if (caseErrors.length) throw new ReviewServiceError('REVIEW_CASE_INVALID', caseErrors.join(','));
    const requestFingerprint = await fingerprint(command, session);
    const action: ReviewAction = {
      from: current.status, to: targetByAction[command.action], action: command.action,
      actor: this.toReviewAuthorization(authorization), occurredAt: now,
      reasonCode: command.reasonCode, reviewerNoteRef: command.reviewerNoteRef,
      expectedVersion: command.expectedVersion,
    };
    const actionErrors = validateReviewAction(current, action);
    if (actionErrors.length) {
      const conflict = actionErrors.includes('REVIEW_CASE_VERSION_CONFLICT') || actionErrors.includes('REVIEW_CASE_STATUS_STALE');
      throw new ReviewServiceError(conflict ? 'REVIEW_VERSION_CONFLICT' : 'REVIEW_ACTION_INVALID', actionErrors.join(','));
    }
    const nextCase: PublisherReviewCase = {
      ...current, status: action.to, updatedAt: now, version: current.version + 1,
    };
    const decision: Omit<ImmutableReviewDecision, 'auditEventRef'> = {
      decisionId: `decision:${requestFingerprint.slice(0, 32)}`, caseId: current.caseId,
      tenant: session.tenant, kind: command.action, actorPrincipalRef: authorization.principalRef,
      authorizationDecisionRef: authorization.decisionRef, reasonCode: command.reasonCode,
      reviewerNoteRef: command.reviewerNoteRef,
      evidenceRequestIds: current.evidenceRequests.map(item => item.requestId),
      caseVersion: nextCase.version, occurredAt: now,
    };
    const audit: ReviewAuditDraft = {
      tenant: session.tenant, actorPrincipalRef: authorization.principalRef,
      authorizationDecisionRef: authorization.decisionRef, action: command.action,
      resourceRef: `publisher-review:${command.caseId}`, reasonCode: command.reasonCode,
      occurredAt: now, correlationRef: command.correlationRef,
    };
    const commit = await this.ports.store.commitMutation({
      tenant: session.tenant, caseId: command.caseId, expectedVersion: command.expectedVersion,
      nextCase, decision, audit, idempotencyKey: command.idempotencyKey, requestFingerprint,
    });
    if (commit.status === 'conflict') throw new ReviewServiceError('REVIEW_VERSION_CONFLICT');
    if (!sameTenant(commit.reviewCase.tenant, session.tenant) || !sameTenant(commit.decision.tenant, session.tenant)) throw new ReviewServiceError('REVIEW_CASE_NOT_FOUND');
    const decisionErrors = validateImmutableReviewDecision(commit.decision);
    if (decisionErrors.length) throw new ReviewServiceError('REVIEW_DECISION_INVALID', decisionErrors.join(','));
    return commit;
  }
  private async resolveSession(credential: string): Promise<VerifiedReviewSession> {
    if (!nonBlank(credential) || credential.length > 8192) throw new ReviewServiceError('REVIEW_SESSION_INVALID');
    const session = await this.ports.sessions.verifySession(credential);
    if (!session || !nonBlank(session.principalRef) || !nonBlank(session.tenant.platformId)
      || !nonBlank(session.tenant.entityId)
      || !['OWNER', 'SECURITY_ADMIN', 'ANALYST', 'VIEWER'].includes(session.role)) {
      throw new ReviewServiceError('REVIEW_SESSION_INVALID');
    }
    return session;
  }
  private clock(): string { return (this.ports.now ?? (() => new Date().toISOString()))(); }
  private validAuthorization(auth: AuthorizationDecision, principalRef: string, permission: string): boolean {
    return auth.allowed && nonBlank(auth.decisionRef) && auth.principalRef === principalRef
      && auth.permission === permission && nonBlank(auth.policyVersion)
      && Number.isFinite(Date.parse(auth.decidedAt));
  }
  private toReviewAuthorization(auth: AuthorizationDecision): ReviewAuthorization {
    return { principalRef: auth.principalRef, decisionRef: auth.decisionRef, permission: auth.permission, policyVersion: auth.policyVersion, decidedAt: auth.decidedAt };
  }
}
