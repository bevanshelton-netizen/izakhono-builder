import {
  assertTenantScope, decideMutation, sameTenantScope, validateAuditEvent,
  validateImmutableApproval, validateMutationContext,
  type AppendOnlyAuditEvent, type IdempotencyReceipt, type MutationContext, type RecordEnvelope,
} from './persistence-contracts';

const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const rejects = (fn: () => unknown, message: string) => { let rejected = false; try { fn(); } catch { rejected = true; } expect(rejected, message); };
const tenant = { platformId: 'izakhono', entityId: 'entity-a' };
const otherTenant = { platformId: 'izakhono', entityId: 'entity-b' };
const hash = 'a'.repeat(64);
const context: MutationContext = {
  tenant, expectedVersion: 2, idempotencyKey: 'publishing-campaign-update-0001',
  requestFingerprint: hash, auditEventRef: 'audit:event:100', occurredAt: '2026-11-26T12:00:00.000Z',
  actor: { principalRef: 'principal:1', decisionRef: 'fortress:decision:1', permission: 'publishing.campaign.update',
    policyVersion: 'policy:v1', decidedAt: '2026-11-26T11:59:59.000Z' },
};
const record: RecordEnvelope = {
  recordId: 'campaign:1', tenant, version: 2, createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-26T11:00:00.000Z', createdByPrincipalRef: 'principal:1', lastAuditEventRef: 'audit:event:99',
};
expect(sameTenantScope(tenant, { ...tenant }), 'identical tenant scope should match');
expect(!sameTenantScope(tenant, otherTenant), 'different entity scope must not match');
rejects(() => assertTenantScope(tenant, otherTenant), 'cross-tenant access must be rejected');

expect(validateMutationContext(context, 'publishing.campaign.update').length === 0, 'valid FORTRESS-backed mutation context should pass');
expect(validateMutationContext({ ...context, actor: { ...context.actor, permission: 'publishing.publisher.read' } }, 'publishing.campaign.update').includes('FORTRESS_PERMISSION_MISMATCH'), 'permission mismatch must fail');
expect(validateMutationContext({ ...context, idempotencyKey: 'short' }, 'publishing.campaign.update').includes('IDEMPOTENCY_KEY_INVALID'), 'weak idempotency key must fail');
expect(validateMutationContext({ ...context, requestFingerprint: 'not-a-hash' }, 'publishing.campaign.update').includes('REQUEST_FINGERPRINT_SHA256_REQUIRED'), 'request fingerprint must be SHA-256');

const apply = decideMutation(record, context, null, 'campaign.update');
expect(apply.kind === 'apply' && apply.nextVersion === 3, 'matching version should increment exactly once');
const stale = decideMutation(record, { ...context, expectedVersion: 1 }, null, 'campaign.update');
expect(stale.kind === 'conflict' && stale.reason === 'VERSION_MISMATCH', 'stale writer must conflict');
const created = decideMutation(null, { ...context, expectedVersion: 0 }, null, 'campaign.create');
expect(created.kind === 'apply' && created.nextVersion === 1, 'new record must start at version one');
const receipt: IdempotencyReceipt = { tenant, operation: 'campaign.update', idempotencyKey: context.idempotencyKey,
  requestFingerprint: hash, resultRecordRef: 'campaign:1', completedAt: '2026-11-26T12:00:01.000Z' };
const replay = decideMutation(record, context, receipt, 'campaign.update');
expect(replay.kind === 'replay' && replay.resultRecordRef === 'campaign:1', 'same request must replay original result');
const keyReuse = decideMutation(record, { ...context, requestFingerprint: 'b'.repeat(64) }, receipt, 'campaign.update');
expect(keyReuse.kind === 'conflict' && keyReuse.reason === 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST', 'idempotency key reuse with different payload must conflict');
rejects(() => decideMutation(record, { ...context, tenant: otherTenant }, receipt, 'campaign.update'), 'foreign-tenant receipt must not replay');

const approval = { approvalId: 'approval:1', tenant, contentAssetId: 'asset:1', contentHash: hash,
  approverPrincipalRef: 'principal:1', authorizationDecisionRef: 'fortress:decision:1',
  purpose: 'customer_publication_approval' as const, approvedAt: '2026-11-26T12:00:00.000Z', auditEventRef: 'audit:event:100' };
expect(validateImmutableApproval(approval).length === 0, 'complete immutable approval should pass');
expect(validateImmutableApproval({ ...approval, contentHash: 'bad' }).includes('APPROVAL_CONTENT_HASH_REQUIRED'), 'approval must bind to a SHA-256 hash');

const audit: AppendOnlyAuditEvent = { eventId: 'audit:100', tenant, actorPrincipalRef: 'principal:1',
  authorizationDecisionRef: 'fortress:decision:1', action: 'campaign.updated', subjectRef: 'campaign:1',
  beforeVersion: 2, afterVersion: 3, occurredAt: '2026-11-26T12:00:00.000Z', correlationRef: 'request:1' };
expect(validateAuditEvent(audit).length === 0, 'complete append-only audit event should pass');
expect(validateAuditEvent({ ...audit, afterVersion: 4 }).includes('AUDIT_VERSION_STEP_INVALID'), 'audit version must advance exactly once');
expect(validateAuditEvent({ ...audit, authorizationDecisionRef: '' }).includes('AUDIT_AUTHORIZATION_PROVENANCE_REQUIRED'), 'audit event must reference FORTRESS decision');

console.log('IZAKHONO PUBLISHER MARKETPLACE PERSISTENCE CONTRACTS: PASS');
