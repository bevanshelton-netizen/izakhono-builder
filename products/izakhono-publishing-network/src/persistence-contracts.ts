/**
 * IZAKHONO PUBLISHING NETWORK — persistence and authorization boundary contracts.
 *
 * These are adapter-facing invariants only. FORTRESS remains the authority for
 * identity and authorization; this module does not authenticate or authorize.
 * No database, network, payment or runtime side effects are performed here.
 */

export interface TenantScope {
  platformId: string;
  entityId: string;
}

export interface FortressAuthorizationContext {
  principalRef: string;
  decisionRef: string;
  permission: string;
  policyVersion: string;
  decidedAt: string;
}

export interface RecordEnvelope {
  recordId: string;
  tenant: TenantScope;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdByPrincipalRef: string;
  lastAuditEventRef: string;
}

export interface MutationContext {
  tenant: TenantScope;
  actor: FortressAuthorizationContext;
  expectedVersion: number;
  idempotencyKey: string;
  requestFingerprint: string;
  auditEventRef: string;
  occurredAt: string;
}

export interface IdempotencyReceipt {
  tenant: TenantScope;
  operation: string;
  idempotencyKey: string;
  requestFingerprint: string;
  resultRecordRef: string;
  completedAt: string;
}

export interface ImmutableApprovalRecord {
  approvalId: string;
  tenant: TenantScope;
  contentAssetId: string;
  contentHash: string;
  approverPrincipalRef: string;
  authorizationDecisionRef: string;
  purpose: 'customer_publication_approval' | 'rights_approval' | 'publisher_change_approval';
  approvedAt: string;
  auditEventRef: string;
}

export interface AppendOnlyAuditEvent {
  eventId: string;
  tenant: TenantScope;
  actorPrincipalRef: string;
  authorizationDecisionRef: string;
  action: string;
  subjectRef: string;
  beforeVersion: number | null;
  afterVersion: number | null;
  occurredAt: string;
  correlationRef: string;
}

export type PersistenceDecision =
  | { kind: 'apply'; nextVersion: number }
  | { kind: 'replay'; resultRecordRef: string }
  | { kind: 'conflict'; reason: 'VERSION_MISMATCH' | 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' };

const nonBlank = (value: string): boolean => typeof value === 'string' && value.trim().length > 0;
const validTime = (value: string): boolean => Number.isFinite(Date.parse(value));
const validHash = (value: string): boolean => /^[a-f0-9]{64}$/i.test(value);

export function sameTenantScope(left: TenantScope, right: TenantScope): boolean {
  return left.platformId === right.platformId && left.entityId === right.entityId;
}

/** Rejects cross-tenant reads/writes before an adapter touches storage. */
export function assertTenantScope(record: TenantScope, request: TenantScope): void {
  if (!sameTenantScope(record, request)) throw new Error('TENANT_SCOPE_MISMATCH');
}

/**
 * Validates evidence that FORTRESS has already authorized this exact mutation.
 * This is a contract check, not a substitute for calling FORTRESS.
 */
export function validateMutationContext(context: MutationContext, requiredPermission: string): string[] {
  const errors: string[] = [];
  if (!nonBlank(context.tenant.platformId) || !nonBlank(context.tenant.entityId)) errors.push('TENANT_SCOPE_REQUIRED');
  if (!nonBlank(context.actor.principalRef) || !nonBlank(context.actor.decisionRef)) errors.push('FORTRESS_DECISION_REFERENCE_REQUIRED');
  if (context.actor.permission !== requiredPermission) errors.push('FORTRESS_PERMISSION_MISMATCH');
  if (!nonBlank(context.actor.policyVersion) || !validTime(context.actor.decidedAt)) errors.push('FORTRESS_POLICY_PROVENANCE_REQUIRED');
  if (!Number.isSafeInteger(context.expectedVersion) || context.expectedVersion < 0) errors.push('EXPECTED_VERSION_INVALID');
  if (!/^[A-Za-z0-9._:-]{16,200}$/.test(context.idempotencyKey)) errors.push('IDEMPOTENCY_KEY_INVALID');
  if (!validHash(context.requestFingerprint)) errors.push('REQUEST_FINGERPRINT_SHA256_REQUIRED');
  if (!nonBlank(context.auditEventRef)) errors.push('AUDIT_EVENT_REFERENCE_REQUIRED');
  if (!validTime(context.occurredAt)) errors.push('MUTATION_TIMESTAMP_INVALID');
  return errors;
}

/** Deterministic optimistic-concurrency and idempotency decision for adapters. */
export function decideMutation(
  current: RecordEnvelope | null,
  context: MutationContext,
  receipt: IdempotencyReceipt | null,
  operation: string,
): PersistenceDecision {
  if (receipt) {
    assertTenantScope(receipt.tenant, context.tenant);
    if (receipt.operation !== operation || receipt.idempotencyKey !== context.idempotencyKey ||
        receipt.requestFingerprint !== context.requestFingerprint) {
      return { kind: 'conflict', reason: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' };
    }
    return { kind: 'replay', resultRecordRef: receipt.resultRecordRef };
  }
  if (current) {
    assertTenantScope(current.tenant, context.tenant);
    if (current.version !== context.expectedVersion) return { kind: 'conflict', reason: 'VERSION_MISMATCH' };
  } else if (context.expectedVersion !== 0) {
    return { kind: 'conflict', reason: 'VERSION_MISMATCH' };
  }
  return { kind: 'apply', nextVersion: context.expectedVersion + 1 };
}

/** Approval records are append-only; corrections require a superseding record. */
export function validateImmutableApproval(approval: ImmutableApprovalRecord): string[] {
  const errors: string[] = [];
  if (!nonBlank(approval.approvalId) || !nonBlank(approval.contentAssetId)) errors.push('APPROVAL_IDENTITY_REQUIRED');
  if (!validHash(approval.contentHash)) errors.push('APPROVAL_CONTENT_HASH_REQUIRED');
  if (!nonBlank(approval.approverPrincipalRef) || !nonBlank(approval.authorizationDecisionRef)) errors.push('APPROVAL_AUTHORIZATION_PROVENANCE_REQUIRED');
  if (!nonBlank(approval.tenant.platformId) || !nonBlank(approval.tenant.entityId)) errors.push('TENANT_SCOPE_REQUIRED');
  if (!nonBlank(approval.auditEventRef)) errors.push('APPROVAL_AUDIT_REFERENCE_REQUIRED');
  if (!validTime(approval.approvedAt)) errors.push('APPROVAL_TIMESTAMP_INVALID');
  return errors;
}

/** Audit events must identify tenant, actor, decision, action and version boundary. */
export function validateAuditEvent(event: AppendOnlyAuditEvent): string[] {
  const errors: string[] = [];
  if (!nonBlank(event.eventId) || !nonBlank(event.action) || !nonBlank(event.subjectRef)) errors.push('AUDIT_EVENT_IDENTITY_REQUIRED');
  if (!nonBlank(event.tenant.platformId) || !nonBlank(event.tenant.entityId)) errors.push('TENANT_SCOPE_REQUIRED');
  if (!nonBlank(event.actorPrincipalRef) || !nonBlank(event.authorizationDecisionRef)) errors.push('AUDIT_AUTHORIZATION_PROVENANCE_REQUIRED');
  if (!nonBlank(event.correlationRef)) errors.push('AUDIT_CORRELATION_REFERENCE_REQUIRED');
  if (!validTime(event.occurredAt)) errors.push('AUDIT_TIMESTAMP_INVALID');
  const versionsValid = (event.beforeVersion === null || (Number.isSafeInteger(event.beforeVersion) && event.beforeVersion >= 0)) &&
    (event.afterVersion === null || (Number.isSafeInteger(event.afterVersion) && event.afterVersion >= 0));
  if (!versionsValid) errors.push('AUDIT_VERSION_INVALID');
  if (event.beforeVersion !== null && event.afterVersion !== null && event.afterVersion !== event.beforeVersion + 1) {
    errors.push('AUDIT_VERSION_STEP_INVALID');
  }
  return errors;
}
