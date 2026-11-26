import {
  PublisherReviewService, ReviewServiceError, type ReviewAuthorizationPort,
  type AuthorizationRequest, type AuthorizationDecision, type ReviewStore,
  type ReviewMutationCommit, type ReviewCommitResult, type TransitionReviewCommand,
} from './publisher-review-service';
import type { PublisherReviewCase, ImmutableReviewDecision } from './publisher-review-queue-contracts';
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const now = '2026-11-26T14:00:00.000Z';
const tenant = { platformId: 'izakhono', entityId: 'tenant:1' };
const base: PublisherReviewCase = {
  caseId: 'review:1', publisherId: 'publisher:1', tenant, status: 'in_review',
  assignedReviewerPrincipalRef: 'principal:reviewer', evidenceRequests: [],
  openedAt: now, updatedAt: now, dueAt: null, version: 2, lastDecisionRef: null,
};
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
  async getCase(scope: typeof tenant, caseId: string): Promise<PublisherReviewCase | null> {
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
  tenant, caseId: 'review:1', actor: { principalRef: 'principal:reviewer' },
  action: 'approve', reasonCode: 'VERIFICATION_COMPLETE', reviewerNoteRef: 'ref:note:1',
  expectedVersion: 2, idempotencyKey: 'idem-key-0001', correlationRef: 'corr:1',
};
async function main() {
  const auth = new FakeAuthorization(); const store = new FakeStore();
  const service = new PublisherReviewService({ authorization: auth, store, now: () => now });
  const result = await service.transition(command);
  expect(result.status === 'committed' && result.reviewCase.status === 'approved', 'authorized transition should commit');
  expect(store.commit?.expectedVersion === 2 && store.commit.nextCase.version === 3, 'compare-and-swap version must advance once');
  expect(store.commit?.audit.authorizationDecisionRef === 'fortress:decision:1', 'audit draft must carry FORTRESS provenance');
  expect(auth.requests[0].permission === 'publishing.review.approve', 'service must request exact action permission');
  expect(store.commit?.decision.auditEventRef === undefined, 'audit event reference is assigned atomically by persistence');
  const deniedAuth = new FakeAuthorization(); deniedAuth.allowed = false;
  const deniedStore = new FakeStore(); const denied = new PublisherReviewService({ authorization: deniedAuth, store: deniedStore, now: () => now });
  let deniedCode = '';
  try { await denied.transition(command); } catch (error) { deniedCode = (error as ReviewServiceError).code; }
  expect(deniedCode === 'REVIEW_AUTHORIZATION_DENIED' && deniedStore.reads === 0, 'denial must happen before any case lookup');
  const spoofAuth = new FakeAuthorization(); spoofAuth.wrongPrincipal = true;
  let spoofCode = '';
  try { await new PublisherReviewService({ authorization: spoofAuth, store: new FakeStore(), now: () => now }).transition(command); } catch (error) { spoofCode = (error as ReviewServiceError).code; }
  expect(spoofCode === 'REVIEW_AUTHORIZATION_RESPONSE_INVALID', 'authorization response for a different principal must fail closed');
  const conflictStore = new FakeStore(); conflictStore.conflict = true;
  let conflictCode = '';
  try { await new PublisherReviewService({ authorization: new FakeAuthorization(), store: conflictStore, now: () => now }).transition(command); } catch (error) { conflictCode = (error as ReviewServiceError).code; }
  expect(conflictCode === 'REVIEW_VERSION_CONFLICT', 'atomic persistence conflict must surface as conflict');
  const readAuth = new FakeAuthorization(); const readStore = new FakeStore();
  const read = await new PublisherReviewService({ authorization: readAuth, store: readStore, now: () => now }).readCase(tenant, 'review:1', { principalRef: 'principal:reviewer' });
  expect(read.caseId === 'review:1' && readAuth.requests[0].permission === 'publishing.review.read', 'read must be authorized at resource scope');
  const foreignStore = new FakeStore(); foreignStore.record = { ...base, tenant: { ...tenant, entityId: 'tenant:other' } };
  let foreignCode = '';
  try { await new PublisherReviewService({ authorization: new FakeAuthorization(), store: foreignStore, now: () => now }).readCase(tenant, 'review:1', { principalRef: 'principal:reviewer' }); } catch (error) { foreignCode = (error as ReviewServiceError).code; }
  expect(foreignCode === 'REVIEW_CASE_NOT_FOUND', 'cross-tenant case must be indistinguishable from absent case');
  console.log('IZAKHONO PUBLISHER REVIEW SERVICE: PASS');
}
void main();
