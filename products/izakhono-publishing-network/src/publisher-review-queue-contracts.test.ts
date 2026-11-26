import {
  validateEvidenceRequestTransition, validateImmutableReviewDecision, validateReviewAction,
  validateReviewCase, type PublisherReviewCase, type ReviewEvidenceRequest, type ReviewAction,
} from './publisher-review-queue-contracts';
const expect = (v: boolean, m: string) => { if (!v) throw new Error(m); };
const now = '2026-11-26T12:00:00.000Z';
const auth = { principalRef: 'principal:reviewer', decisionRef: 'fortress:decision:1', permission: 'publishing.review.approve', policyVersion: 'policy:v1', decidedAt: now };
const evidence: ReviewEvidenceRequest = {
  requestId: 'request:1', kind: 'domain_control', status: 'accepted', requestedByPrincipalRef: 'principal:ops',
  requestedAt: now, dueAt: '2026-12-01T12:00:00.000Z', evidenceRef: 'evidence://opaque/1',
  reviewedByPrincipalRef: 'principal:reviewer', authorizationDecisionRef: 'fortress:decision:1',
  reviewedAt: now, reasonCode: 'EVIDENCE_ACCEPTED',
};
const record: PublisherReviewCase = {
  caseId: 'review:1', publisherId: 'publisher:1', tenant: { platformId: 'izakhono', entityId: 'tenant:1' },
  status: 'in_review', assignedReviewerPrincipalRef: 'principal:reviewer', evidenceRequests: [evidence],
  openedAt: now, updatedAt: now, dueAt: '2026-12-10T12:00:00.000Z', version: 4, lastDecisionRef: null,
};
expect(validateReviewCase(record, now).length === 0, 'valid review case should pass');
const approve: ReviewAction = { from: 'in_review', to: 'approved', action: 'approve', actor: auth, occurredAt: now, reasonCode: 'VERIFICATION_COMPLETE', reviewerNoteRef: 'ref:note:1', expectedVersion: 4 };
expect(validateReviewAction(record, approve).length === 0, 'fully evidenced and authorized approval should pass');
expect(validateReviewAction(record, { ...approve, expectedVersion: 3 }).includes('REVIEW_CASE_VERSION_CONFLICT'), 'stale review writer must fail');
expect(validateReviewAction(record, { ...approve, actor: { ...auth, permission: 'publishing.review.reject' } }).includes('FORTRESS_REVIEW_PERMISSION_MISMATCH'), 'wrong FORTRESS permission must fail');
expect(validateReviewAction({ ...record, evidenceRequests: [{ ...evidence, status: 'submitted' }] }, approve).includes('ALL_REQUESTED_EVIDENCE_MUST_BE_ACCEPTED'), 'unreviewed evidence must block approval');
expect(validateReviewAction(record, { ...approve, reviewerNoteRef: 'email:person@example.com' }).includes('REVIEW_NOTE_MUST_BE_OPAQUE_REFERENCE'), 'notes must not embed personal data');
const submitted = { ...evidence, status: 'submitted' as const, evidenceRef: 'evidence://opaque/2', reviewedByPrincipalRef: null, authorizationDecisionRef: null, reviewedAt: null, reasonCode: null };
expect(validateEvidenceRequestTransition({ ...evidence, status: 'requested', evidenceRef: null, reviewedByPrincipalRef: null, authorizationDecisionRef: null, reviewedAt: null, reasonCode: null }, submitted, auth, now).length === 0, 'evidence submission should pass');
expect(validateEvidenceRequestTransition(evidence, { ...evidence, status: 'requested' }, auth, now).includes('EVIDENCE_REQUEST_TRANSITION_NOT_ALLOWED'), 'accepted evidence cannot be silently reopened');
const decision = { decisionId: 'decision:1', caseId: record.caseId, tenant: record.tenant, kind: 'approve' as const, actorPrincipalRef: auth.principalRef, authorizationDecisionRef: auth.decisionRef, reasonCode: 'VERIFICATION_COMPLETE', reviewerNoteRef: 'ref:note:1', evidenceRequestIds: ['request:1'], caseVersion: 5, occurredAt: now, auditEventRef: 'fortress:audit:1' };
expect(validateImmutableReviewDecision(decision).length === 0, 'immutable decision should pass');
expect(validateImmutableReviewDecision({ ...decision, evidenceRequestIds: ['request:1', 'request:1'] }).includes('REVIEW_DECISION_EVIDENCE_IDS_DUPLICATED'), 'duplicate evidence references must fail');
console.log('IZAKHONO PUBLISHER REVIEW QUEUE CONTRACTS: PASS');
