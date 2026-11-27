import {
  PublisherReviewService, ReviewServiceError, type ReviewAuthorizationPort,
  type AuthorizationRequest, type AuthorizationDecision, type ReviewSessionVerifier,
  type VerifiedReviewSession, type ReviewStore, type ReviewMutationCommit,
  type ReviewCommitResult, type TransitionReviewCommand, type RequestEvidenceCommand,
} from './publisher-review-service';
import type { PublisherReviewCase, ImmutableReviewDecision } from './publisher-review-queue-contracts';
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const now = '2026-11-26T14:00:00.000Z';
const session: VerifiedReviewSession = {
  principalRef: 'principal:reviewer', tenant: { platformId: 'izakhono', entityId: 'tenant:1' }, role: 'administrator',
};
const base: PublisherReviewCase = {
  caseId: 'review:1', publisherId: 'publisher:1', tenant: session.tenant, status: 'in_review',
  assignedReviewerPrincipalRef: 'principal:reviewer', evidenceRequests: [],
  openedAt: now, updatedAt: now, dueAt: null, version: 2, lastDecisionRef: null,
};
class FakeSessions implements ReviewSessionVerifier {
  valid = true;
  async verifySession(credential: string): Promise<VerifiedReviewSession | null> { return this.valid && credential === 'fortress-session' ? session : null; }
}
class FakeAuthorization implements ReviewAuthorizationPort {
  requests: AuthorizationRequest[] = [];
  allowed = true;
  wrongPrincipal = false;
  async authorize(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    this.requests.push(request);
    return { allowed: this.allowed, decisionRef: 'fortress:decision:1',
      principalRef: this.wrongPrincipal ? 'principal:other' : request.principalRef,
      permission: request.permission, policyVersion: 'fortress-policy:v1', decidedAt: now };
  }
}
class FakeStore implements ReviewStore {
  record: PublisherReviewCase | null = { ...base };
  reads = 0;
  commit: ReviewMutationCommit | null = null;
  conflict = false;
  receipt: { key: string; fingerprint: string; reviewCase: PublisherReviewCase; decision: ImmutableReviewDecision } | null = null;
  async lookupIdempotency(scope: typeof session.tenant, key: string, fingerprint: string): Promise<Extract<ReviewCommitResult, { status: 'replayed' | 'conflict' }> | null> {
    if (!this.receipt || this.receipt.key !== key) return null;
    if (this.receipt.fingerprint !== fingerprint || scope.entityId !== this.receipt.reviewCase.tenant.entityId || scope.platformId !== this.receipt.reviewCase.tenant.platformId) return { status: 'conflict' };
    return { status: 'replayed', reviewCase: this.receipt.reviewCase, decision: this.receipt.decision, replayed: true };
  }
  async getCase(scope: typeof session.tenant, caseId: string): Promise<PublisherReviewCase | null> {
    this.reads++;
    if (!this.record || caseId !== this.record.caseId || scope.entityId !== this.record.tenant.entityId) return null;
    return this.record;
  }
  async commitMutation(input: ReviewMutationCommit): Promise<ReviewCommitResult> {
    this.commit = input;
    if (this.conflict) return { status: 'conflict' };
    if (this.receipt && this.receipt.key === input.idempotencyKey) {
      if (this.receipt.fingerprint !== input.requestFingerprint) return { status: 'conflict' };
      return { status: 'replayed', reviewCase: this.receipt.reviewCase, decision: this.receipt.decision, replayed: true };
    }
    const decision: ImmutableReviewDecision = { ...input.decision, auditEventRef: 'audit:event:1' };
    this.record = input.nextCase;
    this.receipt = { key: input.idempotencyKey, fingerprint: input.requestFingerprint, reviewCase: input.nextCase, decision };
    return { status: 'committed', reviewCase: input.nextCase, decision, replayed: false };
  }
}
const command: TransitionReviewCommand = {
  sessionCredential: 'fortress-session', caseId: 'review:1', action: 'approve',
  reasonCode: 'VERIFICATION_COMPLETE', reviewerNoteRef: 'ref:note:1',
  expectedVersion: 2, idempotencyKey: 'idem-key-0001', correlationRef: 'corr:1',
};
async function main() {
  const sessions = new FakeSessions(); const auth = new FakeAuthorization(); const store = new FakeStore();
  const service = new PublisherReviewService({ sessions, authorization: auth, store, now: () => now });
  const result = await service.transition(command);
  expect(result.status === 'committed' && result.reviewCase.status === 'approved', 'authorized transition should commit');
  expect(store.commit?.expectedVersion === 2 && store.commit.nextCase.version === 3, 'compare-and-swap version must advance once');
  expect(store.commit?.audit.authorizationDecisionRef === 'fortress:decision:1', 'audit draft must carry FORTRESS provenance');
  expect(auth.requests[0].permission === 'publishing.review.approve', 'service must request exact action permission');
  expect(auth.requests[0].identityRole === 'administrator', 'verified FORTRESS role is context, not caller input');
  expect(store.commit?.decision.auditEventRef === undefined, 'audit event reference is assigned atomically by persistence');
  const replay = await service.transition(command);
  expect(replay.status === 'replayed' && store.reads === 1, 'identical idempotent retry must replay without rereading a changed case version');
  let idempotencyConflict = '';
  try { await service.transition({ ...command, reasonCode: 'DIFFERENT_REASON' }); } catch (error) { idempotencyConflict = (error as ReviewServiceError).code; }
  expect(idempotencyConflict === 'REVIEW_IDEMPOTENCY_CONFLICT' && store.reads === 1, 'reusing an idempotency key for a different request must fail before case lookup');
  const deniedAuth = new FakeAuthorization(); deniedAuth.allowed = false;
  const deniedStore = new FakeStore(); const denied = new PublisherReviewService({ sessions, authorization: deniedAuth, store: deniedStore, now: () => now });
  let deniedCode = '';
  try { await denied.transition(command); } catch (error) { deniedCode = (error as ReviewServiceError).code; }
  expect(deniedCode === 'REVIEW_AUTHORIZATION_DENIED' && deniedStore.reads === 0, 'denial must happen before any case lookup');
  const invalidSessions = new FakeSessions(); invalidSessions.valid = false;
  const invalidAuth = new FakeAuthorization(); const invalidStore = new FakeStore();
  let invalidCode = '';
  try { await new PublisherReviewService({ sessions: invalidSessions, authorization: invalidAuth, store: invalidStore, now: () => now }).transition(command); } catch (error) { invalidCode = (error as ReviewServiceError).code; }
  expect(invalidCode === 'REVIEW_SESSION_INVALID' && invalidAuth.requests.length === 0 && invalidStore.reads === 0, 'invalid FORTRESS session must fail before authorization or storage');
  const spoofAuth = new FakeAuthorization(); spoofAuth.wrongPrincipal = true;
  let spoofCode = '';
  try { await new PublisherReviewService({ sessions, authorization: spoofAuth, store: new FakeStore(), now: () => now }).transition(command); } catch (error) { spoofCode = (error as ReviewServiceError).code; }
  expect(spoofCode === 'REVIEW_AUTHORIZATION_RESPONSE_INVALID', 'authorization response for a different principal must fail closed');
  const conflictStore = new FakeStore(); conflictStore.conflict = true;
  let conflictCode = '';
  try { await new PublisherReviewService({ sessions, authorization: new FakeAuthorization(), store: conflictStore, now: () => now }).transition(command); } catch (error) { conflictCode = (error as ReviewServiceError).code; }
  expect(conflictCode === 'REVIEW_VERSION_CONFLICT', 'atomic persistence conflict must surface as conflict');
  const readAuth = new FakeAuthorization(); const readStore = new FakeStore();
  const read = await new PublisherReviewService({ sessions, authorization: readAuth, store: readStore, now: () => now }).readCase('fortress-session', 'review:1');
  expect(read.caseId === 'review:1' && readAuth.requests[0].permission === 'publishing.review.read', 'read must be authorized at resource scope');
  const foreignStore = new FakeStore(); foreignStore.record = { ...base, tenant: { ...session.tenant, entityId: 'tenant:other' } };
  let foreignCode = '';
  try { await new PublisherReviewService({ sessions, authorization: new FakeAuthorization(), store: foreignStore, now: () => now }).readCase('fortress-session', 'review:1'); } catch (error) { foreignCode = (error as ReviewServiceError).code; }
  expect(foreignCode === 'REVIEW_CASE_NOT_FOUND', 'cross-tenant case must be indistinguishable from absent case');

  const evidenceStore = new FakeStore();
  const evidenceAuth = new FakeAuthorization();
  const evidenceService = new PublisherReviewService({ sessions, authorization: evidenceAuth, store: evidenceStore, now: () => now });
  const evidenceCommand: RequestEvidenceCommand = {
    sessionCredential: 'fortress-session', caseId: 'review:1', requestId: 'evidence-request:1',
    kind: 'domain_control', dueAt: '2026-11-28T14:00:00.000Z',
    reasonCode: 'EVIDENCE_DOMAIN_CONTROL_REQUIRED', reviewerNoteRef: 'ref:note:2',
    expectedVersion: 2, idempotencyKey: 'evidence-idem-1', correlationRef: 'corr:evidence:1',
  };
  const evidenceResult = await evidenceService.requestEvidence(evidenceCommand);
  expect(evidenceResult.status === 'committed' && evidenceResult.reviewCase.status === 'awaiting_evidence', 'evidence request must move review into awaiting_evidence');
  expect(evidenceResult.reviewCase.evidenceRequests[0].requestId === 'evidence-request:1', 'evidence request must be persisted in the case');
  expect(evidenceStore.commit?.decision.evidenceRequestIds[0] === 'evidence-request:1', 'immutable decision must reference the requested evidence');
  expect(evidenceAuth.requests[0].permission === 'publishing.review.request_evidence', 'evidence request must use exact FORTRESS action permission');
  const evidenceReplay = await evidenceService.requestEvidence(evidenceCommand);
  expect(evidenceReplay.status === 'replayed', 'identical evidence request retry must replay the original result');
  let evidenceKeyConflict = '';
  try { await evidenceService.requestEvidence({ ...evidenceCommand, requestId: 'evidence-request:other' }); } catch (error) { evidenceKeyConflict = (error as ReviewServiceError).code; }
  expect(evidenceKeyConflict === 'REVIEW_IDEMPOTENCY_CONFLICT', 'evidence request idempotency key cannot be reused with a changed payload');
  console.log('IZAKHONO PUBLISHER REVIEW SERVICE: PASS');
}
void main();
