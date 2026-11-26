import {
  PublisherReviewService, ReviewServiceError, type ReviewAuthorizationPort,
  type AuthorizationRequest, type AuthorizationDecision, type ReviewSessionVerifier,
  type VerifiedReviewSession, type ReviewStore, type ReviewMutationCommit,
  type ReviewCommitResult, type TransitionReviewCommand,
} from './publisher-review-service';
import type { PublisherReviewCase, ImmutableReviewDecision } from './publisher-review-queue-contracts';
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const now = '2026-11-26T14:00:00.000Z';
const session: VerifiedReviewSession = {
  principalRef: 'principal:reviewer', tenant: { platformId: 'izakhono', entityId: 'tenant:1' }, role: 'SECURITY_ADMIN',
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
  async getCase(scope: typeof session.tenant, caseId: string): Promise<PublisherReviewCase | null> {
    this.reads++;
    if (!this.record || caseId !== this.record.caseId || scope.entityId !== this.record.tenant.entityId) return null;
    return this.record;
  }
  async commitMutation(input: ReviewMutationCommit): Promise<ReviewCommitResult> {
    this.commit = input;
    if (this.conflict) return { status: 'conflict' };
    const decision: ImmutableReviewDecision = { ...input.decision, auditEventRef: 'audit:event:1' };
    this.record = input.nextCase;
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
  expect(auth.requests[0].permission === 'publishing:review:approve', 'service must request exact action permission');
  expect(auth.requests[0].identityRole === 'SECURITY_ADMIN', 'verified FORTRESS role is context, not caller input');
  expect(store.commit?.decision.auditEventRef === undefined, 'audit event reference is assigned atomically by persistence');
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
  expect(read.caseId === 'review:1' && readAuth.requests[0].permission === 'publishing:review:read', 'read must be authorized at resource scope');
  const foreignStore = new FakeStore(); foreignStore.record = { ...base, tenant: { ...session.tenant, entityId: 'tenant:other' } };
  let foreignCode = '';
  try { await new PublisherReviewService({ sessions, authorization: new FakeAuthorization(), store: foreignStore, now: () => now }).readCase('fortress-session', 'review:1'); } catch (error) { foreignCode = (error as ReviewServiceError).code; }
  expect(foreignCode === 'REVIEW_CASE_NOT_FOUND', 'cross-tenant case must be indistinguishable from absent case');
  console.log('IZAKHONO PUBLISHER REVIEW SERVICE: PASS');
}
void main();
