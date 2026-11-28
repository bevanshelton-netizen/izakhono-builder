/**
 * IZAKHONO PUBLISHING NETWORK — private publisher review-queue contracts.
 * Pure domain rules only: no reviewer identity, authorization, evidence storage,
 * notifications, database writes or public listing side effects.
 *
 * Evidence payloads are represented only by opaque references. Do not put
 * identity documents, personal data, credentials or raw uploads in reviewer notes.
 */
export type ReviewCaseStatus = 'open' | 'in_review' | 'awaiting_evidence' | 'approved' | 'rejected' | 'closed';
export type EvidenceRequestStatus = 'requested' | 'submitted' | 'accepted' | 'rejected' | 'expired';
export type ReviewDecisionKind = 'approve' | 'reject' | 'request_evidence' | 'return_to_queue' | 'close';

export interface ReviewTenantScope { platformId: string; entityId: string; }
export interface ReviewEvidenceRequest {
  requestId: string;
  kind: 'legal_identity' | 'authorized_representative' | 'domain_control' | 'editorial_policy' | 'sample_content' | 'traffic_metrics' | 'audience_metrics' | 'other';
  status: EvidenceRequestStatus;
  requestedByPrincipalRef: string;
  requestedAt: string;
  dueAt: string;
  evidenceRef: string | null;
  reviewedByPrincipalRef: string | null;
  authorizationDecisionRef: string | null;
  reviewedAt: string | null;
  reasonCode: string | null;
}
export interface PublisherReviewCase {
  caseId: string;
  publisherId: string;
  tenant: ReviewTenantScope;
  status: ReviewCaseStatus;
  assignedReviewerPrincipalRef: string | null;
  evidenceRequests: ReviewEvidenceRequest[];
  openedAt: string;
  updatedAt: string;
  dueAt: string | null;
  version: number;
  lastDecisionRef: string | null;
}
export interface ReviewAuthorization {
  principalRef: string;
  decisionRef: string;
  permission: string;
  policyVersion: string;
  decidedAt: string;
}
export interface ReviewAction {
  from: ReviewCaseStatus;
  to: ReviewCaseStatus;
  action: ReviewDecisionKind;
  actor: ReviewAuthorization;
  occurredAt: string;
  reasonCode: string;
  reviewerNoteRef: string | null;
  expectedVersion: number;
}
export interface ImmutableReviewDecision {
  decisionId: string;
  caseId: string;
  tenant: ReviewTenantScope;
  kind: ReviewDecisionKind;
  actorPrincipalRef: string;
  authorizationDecisionRef: string;
  reasonCode: string;
  reviewerNoteRef: string | null;
  evidenceRequestIds: string[];
  caseVersion: number;
  occurredAt: string;
  auditEventRef: string;
}
const nonBlank = (v: string): boolean => typeof v === 'string' && v.trim().length > 0;
const validTime = (v: string): boolean => Number.isFinite(Date.parse(v));
const permissions: Record<ReviewDecisionKind, string> = {
  approve: 'publishing.review.approve',
  reject: 'publishing.review.reject',
  request_evidence: 'publishing.review.request_evidence',
  return_to_queue: 'publishing.review.assign',
  close: 'publishing.review.close',
};
const allowed: Record<ReviewCaseStatus, ReviewCaseStatus[]> = {
  open: ['in_review', 'closed'],
  in_review: ['awaiting_evidence', 'approved', 'rejected', 'open', 'closed'],
  awaiting_evidence: ['in_review', 'closed'],
  approved: ['closed'],
  rejected: ['closed'],
  closed: [],
};
export function validateReviewCase(record: PublisherReviewCase, now = new Date().toISOString()): string[] {
  const errors: string[] = [];
  if (!nonBlank(record.caseId) || !nonBlank(record.publisherId) || !nonBlank(record.tenant.platformId) || !nonBlank(record.tenant.entityId)) errors.push('REVIEW_CASE_IDENTITY_REQUIRED');
  if (!Number.isSafeInteger(record.version) || record.version < 1) errors.push('REVIEW_CASE_VERSION_INVALID');
  if (!validTime(record.openedAt) || !validTime(record.updatedAt) || Date.parse(record.updatedAt) < Date.parse(record.openedAt)) errors.push('REVIEW_CASE_TIMESTAMPS_INVALID');
  if (record.dueAt !== null && (!validTime(record.dueAt) || Date.parse(record.dueAt) < Date.parse(record.openedAt))) errors.push('REVIEW_CASE_DUE_DATE_INVALID');
  const ids = new Set<string>();
  for (const request of record.evidenceRequests) {
    if (!nonBlank(request.requestId) || ids.has(request.requestId)) errors.push('EVIDENCE_REQUEST_ID_MISSING_OR_DUPLICATE');
    ids.add(request.requestId);
    if (!nonBlank(request.requestedByPrincipalRef) || !validTime(request.requestedAt) || !validTime(request.dueAt) || Date.parse(request.dueAt) <= Date.parse(request.requestedAt)) errors.push('EVIDENCE_REQUEST_PROVENANCE_OR_DUE_DATE_INVALID');
    if (request.status === 'submitted' && !nonBlank(request.evidenceRef ?? '')) errors.push('SUBMITTED_EVIDENCE_REFERENCE_REQUIRED');
    if (request.status === 'accepted' || request.status === 'rejected') {
      if (!nonBlank(request.reviewedByPrincipalRef ?? '') || !nonBlank(request.authorizationDecisionRef ?? '') || !validTime(request.reviewedAt ?? '')) errors.push('EVIDENCE_REVIEW_AUTHORIZATION_REQUIRED');
    }
    if (request.status === 'expired' && Date.parse(request.dueAt) > Date.parse(now)) errors.push('EVIDENCE_REQUEST_PREMATURELY_EXPIRED');
  }
  return [...new Set(errors)];
}
export function validateReviewAction(record: PublisherReviewCase, action: ReviewAction): string[] {
  const errors: string[] = [];
  if (action.from !== record.status) errors.push('REVIEW_CASE_STATUS_STALE');
  if (action.expectedVersion !== record.version) errors.push('REVIEW_CASE_VERSION_CONFLICT');
  if (!allowed[action.from]?.includes(action.to)) errors.push('REVIEW_CASE_TRANSITION_NOT_ALLOWED');
  if (!nonBlank(action.actor.principalRef) || !nonBlank(action.actor.decisionRef) || !nonBlank(action.actor.policyVersion) || !validTime(action.actor.decidedAt)) errors.push('FORTRESS_REVIEW_AUTHORIZATION_PROVENANCE_REQUIRED');
  if (action.actor.permission !== permissions[action.action]) errors.push('FORTRESS_REVIEW_PERMISSION_MISMATCH');
  if (!validTime(action.occurredAt) || Date.parse(action.occurredAt) < Date.parse(record.updatedAt)) errors.push('REVIEW_ACTION_TIMESTAMP_INVALID');
  if (!nonBlank(action.reasonCode)) errors.push('REVIEW_REASON_CODE_REQUIRED');
  if (action.reviewerNoteRef !== null && !/^ref:[A-Za-z0-9._:/-]{3,200}$/.test(action.reviewerNoteRef)) errors.push('REVIEW_NOTE_MUST_BE_OPAQUE_REFERENCE');
  const expected: Record<ReviewDecisionKind, ReviewCaseStatus> = {
    approve: 'approved', reject: 'rejected', request_evidence: 'awaiting_evidence',
    return_to_queue: 'open', close: 'closed',
  };
  if (expected[action.action] !== action.to) errors.push('REVIEW_ACTION_TARGET_MISMATCH');
  if (action.action === 'approve' && record.evidenceRequests.some(r => r.status !== 'accepted')) errors.push('ALL_REQUESTED_EVIDENCE_MUST_BE_ACCEPTED');
  if (action.action === 'request_evidence' && !action.reasonCode.startsWith('EVIDENCE_')) errors.push('EVIDENCE_REQUEST_REASON_CODE_REQUIRED');
  if (action.action === 'return_to_queue' && !record.assignedReviewerPrincipalRef) errors.push('REVIEW_ASSIGNMENT_REQUIRED_BEFORE_RETURN');
  return [...new Set(errors)];
}
export function validateEvidenceRequestTransition(
  current: ReviewEvidenceRequest,
  next: ReviewEvidenceRequest,
  actor: ReviewAuthorization,
  occurredAt: string,
): string[] {
  const errors: string[] = [];
  const allowedNext: Record<EvidenceRequestStatus, EvidenceRequestStatus[]> = {
    requested: ['submitted', 'expired'], submitted: ['accepted', 'rejected'], accepted: [], rejected: ['submitted'], expired: ['submitted'],
  };
  if (current.requestId !== next.requestId || current.kind !== next.kind) errors.push('EVIDENCE_REQUEST_IDENTITY_IMMUTABLE');
  if (!allowedNext[current.status].includes(next.status)) errors.push('EVIDENCE_REQUEST_TRANSITION_NOT_ALLOWED');
  if (!nonBlank(actor.principalRef) || !nonBlank(actor.decisionRef) || !validTime(actor.decidedAt)) errors.push('FORTRESS_EVIDENCE_REVIEW_AUTHORIZATION_REQUIRED');
  if (!validTime(occurredAt)) errors.push('EVIDENCE_TRANSITION_TIMESTAMP_INVALID');
  if (next.status === 'submitted' && !nonBlank(next.evidenceRef ?? '')) errors.push('SUBMITTED_EVIDENCE_REFERENCE_REQUIRED');
  if (next.status === 'accepted' || next.status === 'rejected') {
    if (!nonBlank(next.reviewedByPrincipalRef ?? '') || next.reviewedByPrincipalRef !== actor.principalRef || next.authorizationDecisionRef !== actor.decisionRef || next.reviewedAt !== occurredAt) errors.push('EVIDENCE_REVIEW_ACTOR_PROVENANCE_MISMATCH');
  }
  return [...new Set(errors)];
}
export function validateImmutableReviewDecision(decision: ImmutableReviewDecision): string[] {
  const errors: string[] = [];
  if (!nonBlank(decision.decisionId) || !nonBlank(decision.caseId) || !nonBlank(decision.tenant.platformId) || !nonBlank(decision.tenant.entityId)) errors.push('REVIEW_DECISION_IDENTITY_REQUIRED');
  if (!nonBlank(decision.actorPrincipalRef) || !nonBlank(decision.authorizationDecisionRef) || !nonBlank(decision.auditEventRef)) errors.push('REVIEW_DECISION_PROVENANCE_REQUIRED');
  if (!nonBlank(decision.reasonCode) || !Number.isSafeInteger(decision.caseVersion) || decision.caseVersion < 1 || !validTime(decision.occurredAt)) errors.push('REVIEW_DECISION_DETAILS_INVALID');
  if (decision.reviewerNoteRef !== null && !/^ref:[A-Za-z0-9._:/-]{3,200}$/.test(decision.reviewerNoteRef)) errors.push('REVIEW_NOTE_MUST_BE_OPAQUE_REFERENCE');
  if (new Set(decision.evidenceRequestIds).size !== decision.evidenceRequestIds.length) errors.push('REVIEW_DECISION_EVIDENCE_IDS_DUPLICATED');
  return errors;
}
