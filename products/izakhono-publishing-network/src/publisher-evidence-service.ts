/**
 * Private publisher evidence submission and review application service.
 * Storage, identity, authorization and persistence are injected ports. This
 * module accepts opaque references only; it never receives raw documents.
 */
export type EvidenceKind = 'legal_identity' | 'authorized_representative' | 'domain_control' | 'editorial_policy' | 'sample_content' | 'traffic_metrics' | 'audience_metrics' | 'other';
export type EvidenceStatus = 'awaiting_submission' | 'submitted' | 'accepted' | 'rejected';
export interface EvidenceTenant { platformId: string; entityId: string; }
export interface EvidenceActor { principalRef: string; tenant: EvidenceTenant; publisherId: string | null; role: 'owner' | 'administrator' | 'technician' | 'auditor' | 'viewer' | 'publisher'; }
export interface EvidenceSessionPort { verify(credential: string): Promise<EvidenceActor | null>; }
export interface EvidenceAuthorizationPort {
  authorize(input: { tenant: EvidenceTenant; principalRef: string; role: EvidenceActor['role']; resourceRef: string; permission: 'publishing.evidence.submit' | 'publishing.evidence.review' }): Promise<{ allowed: boolean; decisionRef: string; principalRef: string; tenant: EvidenceTenant; resourceRef: string; permission: string; policyVersion: string; decidedAt: string }>;
}
export interface EvidenceStoragePort {
  /** Confirms an opaque object reference exists, is immutable, and is scoped to this tenant and request. */
  verifyReference(input: { opaqueRef: string; tenant: EvidenceTenant; requestId: string; publisherId: string }): Promise<boolean>;
}
export interface PublisherEvidenceRecord {
  evidenceId: string; requestId: string; publisherId: string; tenant: EvidenceTenant; kind: EvidenceKind;
  opaqueRef: string; status: EvidenceStatus; submittedBy: string; submittedAt: string;
  reviewedBy: string | null; reviewedAt: string | null; reviewDecisionRef: string | null; reasonCode: string | null; version: number;
}
export interface EvidenceAuditEvent {
  tenant: EvidenceTenant; actorPrincipalRef: string; authorizationDecisionRef: string;
  action: 'submit' | 'accept' | 'reject'; resourceRef: string; reasonCode: string; occurredAt: string; correlationRef: string;
}
export interface EvidenceMutation {
  tenant: EvidenceTenant; evidenceId: string; expectedVersion: number; next: PublisherEvidenceRecord;
  audit: EvidenceAuditEvent; idempotencyKey: string; requestFingerprint: string;
}
export type EvidenceMutationResult =
  | { status: 'committed'; record: PublisherEvidenceRecord; replayed: false }
  | { status: 'replayed'; record: PublisherEvidenceRecord; replayed: true }
  | { status: 'conflict' };
export interface PublisherEvidenceStore {
  lookupIdempotency(tenant: EvidenceTenant, key: string, fingerprint: string): Promise<Extract<EvidenceMutationResult, {status:'replayed'|'conflict'}> | null>;
  get(tenant: EvidenceTenant, evidenceId: string): Promise<PublisherEvidenceRecord | null>;
  commit(input: EvidenceMutation): Promise<EvidenceMutationResult>;
}
export interface PublisherEvidencePorts {
  sessions: EvidenceSessionPort; authorization: EvidenceAuthorizationPort;
  storage: EvidenceStoragePort; store: PublisherEvidenceStore; now?: () => string;
}
export interface SubmitEvidenceCommand {
  credential: string; evidenceId: string; requestId: string; publisherId: string; kind: EvidenceKind;
  opaqueRef: string; expectedVersion: number; idempotencyKey: string; correlationRef: string;
}
export interface ReviewEvidenceCommand {
  credential: string; evidenceId: string; decision: 'accept' | 'reject'; reasonCode: string;
  expectedVersion: number; idempotencyKey: string; correlationRef: string;
}
export type EvidenceServiceErrorCode = 'EVIDENCE_SESSION_INVALID'|'EVIDENCE_AUTHORIZATION_DENIED'|'EVIDENCE_AUTHORIZATION_INVALID'|'EVIDENCE_INPUT_INVALID'|'EVIDENCE_REFERENCE_INVALID'|'EVIDENCE_NOT_FOUND'|'EVIDENCE_VERSION_CONFLICT'|'EVIDENCE_IDEMPOTENCY_CONFLICT'|'EVIDENCE_STATE_INVALID';
export class EvidenceServiceError extends Error {
  constructor(readonly code: EvidenceServiceErrorCode) { super(code); this.name = 'EvidenceServiceError'; }
}
const nonBlank = (v: string): boolean => typeof v === 'string' && v.trim().length > 0;
const sameTenant = (a: EvidenceTenant, b: EvidenceTenant): boolean => a.platformId === b.platformId && a.entityId === b.entityId;
const kinds: EvidenceKind[] = ['legal_identity','authorized_representative','domain_control','editorial_policy','sample_content','traffic_metrics','audience_metrics','other'];
async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
}
export class PublisherEvidenceService {
  constructor(private readonly ports: PublisherEvidencePorts) {}
  async submit(command: SubmitEvidenceCommand): Promise<EvidenceMutationResult> {
    if (![command.evidenceId,command.requestId,command.publisherId,command.opaqueRef,command.idempotencyKey,command.correlationRef].every(nonBlank)
      || command.idempotencyKey.length > 200 || !kinds.includes(command.kind) || !Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 1
      || !/^ref:[A-Za-z0-9._:/-]{3,200}$/.test(command.opaqueRef)) throw new EvidenceServiceError('EVIDENCE_INPUT_INVALID');
    const actor = await this.actor(command.credential);
    const permission = 'publishing.evidence.submit' as const;
    const resourceRef = `publisher-evidence:${command.evidenceId}`;
    const auth = await this.ports.authorization.authorize({tenant:actor.tenant,principalRef:actor.principalRef,role:actor.role,resourceRef,permission});
    this.authorized(auth, actor, resourceRef, permission);
    if (actor.role !== 'publisher' || actor.publisherId !== command.publisherId) throw new EvidenceServiceError('EVIDENCE_AUTHORIZATION_DENIED');
    if (!await this.ports.storage.verifyReference({opaqueRef:command.opaqueRef,tenant:actor.tenant,requestId:command.requestId,publisherId:command.publisherId})) throw new EvidenceServiceError('EVIDENCE_REFERENCE_INVALID');
    const fp = await digest({tenant:actor.tenant,principal:actor.principalRef,...command,credential:undefined});
    const prior = await this.ports.store.lookupIdempotency(actor.tenant,command.idempotencyKey,fp);
    if (prior?.status === 'replayed') return prior;
    if (prior?.status === 'conflict') throw new EvidenceServiceError('EVIDENCE_IDEMPOTENCY_CONFLICT');
    const current = await this.ports.store.get(actor.tenant,command.evidenceId);
    if (!current || !sameTenant(current.tenant,actor.tenant)) throw new EvidenceServiceError('EVIDENCE_NOT_FOUND');
    if (current.version !== command.expectedVersion) throw new EvidenceServiceError('EVIDENCE_VERSION_CONFLICT');
    if (current.status !== 'awaiting_submission' || current.requestId !== command.requestId || current.publisherId !== command.publisherId || current.kind !== command.kind) throw new EvidenceServiceError('EVIDENCE_STATE_INVALID');
    const now = this.clock();
    const next = {...current,status:'submitted' as const,opaqueRef:command.opaqueRef,submittedBy:actor.principalRef,submittedAt:now,version:current.version+1};
    return this.commit(actor,next,'submit',auth.decisionRef,'EVIDENCE_SUBMITTED',command.correlationRef,command.idempotencyKey,fp,command.expectedVersion);
  }
  async review(command: ReviewEvidenceCommand): Promise<EvidenceMutationResult> {
    if (![command.evidenceId,command.idempotencyKey,command.correlationRef,command.reasonCode].every(nonBlank)
      || command.idempotencyKey.length > 200 || command.reasonCode.length > 128
      || !['accept','reject'].includes(command.decision) || !Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 1) throw new EvidenceServiceError('EVIDENCE_INPUT_INVALID');
    const actor = await this.actor(command.credential);
    const permission = 'publishing.evidence.review' as const;
    const resourceRef = `publisher-evidence:${command.evidenceId}`;
    const auth = await this.ports.authorization.authorize({tenant:actor.tenant,principalRef:actor.principalRef,role:actor.role,resourceRef,permission});
    this.authorized(auth,actor,resourceRef,permission);
    if (actor.role === 'publisher' || actor.role === 'viewer') throw new EvidenceServiceError('EVIDENCE_AUTHORIZATION_DENIED');
    const fp = await digest({tenant:actor.tenant,principal:actor.principalRef,...command,credential:undefined});
    const prior = await this.ports.store.lookupIdempotency(actor.tenant,command.idempotencyKey,fp);
    if (prior?.status === 'replayed') return prior;
    if (prior?.status === 'conflict') throw new EvidenceServiceError('EVIDENCE_IDEMPOTENCY_CONFLICT');
    const current = await this.ports.store.get(actor.tenant,command.evidenceId);
    if (!current || !sameTenant(current.tenant,actor.tenant)) throw new EvidenceServiceError('EVIDENCE_NOT_FOUND');
    if (current.version !== command.expectedVersion) throw new EvidenceServiceError('EVIDENCE_VERSION_CONFLICT');
    if (current.status !== 'submitted') throw new EvidenceServiceError('EVIDENCE_STATE_INVALID');
    const now = this.clock();
    const next = {...current,status:command.decision === 'accept' ? 'accepted' as const : 'rejected' as const,reviewedBy:actor.principalRef,reviewedAt:now,reviewDecisionRef:auth.decisionRef,reasonCode:command.reasonCode,version:current.version+1};
    return this.commit(actor,next,command.decision,auth.decisionRef,command.reasonCode,command.correlationRef,command.idempotencyKey,fp,command.expectedVersion);
  }
  private async commit(actor: EvidenceActor,next: PublisherEvidenceRecord,action: EvidenceAuditEvent['action'],decisionRef: string,reasonCode: string,correlationRef: string,key: string,fp: string,expectedVersion: number): Promise<EvidenceMutationResult> {
    const now = this.clock();
    const result = await this.ports.store.commit({tenant:actor.tenant,evidenceId:next.evidenceId,expectedVersion,next,audit:{tenant:actor.tenant,actorPrincipalRef:actor.principalRef,authorizationDecisionRef:decisionRef,action,resourceRef:`publisher-evidence:${next.evidenceId}`,reasonCode,occurredAt:now,correlationRef},idempotencyKey:key,requestFingerprint:fp});
    if (result.status === 'conflict') throw new EvidenceServiceError('EVIDENCE_VERSION_CONFLICT');
    if (!sameTenant(result.record.tenant,actor.tenant)) throw new EvidenceServiceError('EVIDENCE_NOT_FOUND');
    return result;
  }
  private async actor(credential: string): Promise<EvidenceActor> {
    if (!nonBlank(credential) || credential.length > 8192) throw new EvidenceServiceError('EVIDENCE_SESSION_INVALID');
    const actor = await this.ports.sessions.verify(credential);
    if (!actor || !nonBlank(actor.principalRef) || !nonBlank(actor.tenant.platformId) || !nonBlank(actor.tenant.entityId) || (actor.role === 'publisher' && !nonBlank(actor.publisherId ?? ''))) throw new EvidenceServiceError('EVIDENCE_SESSION_INVALID');
    return actor;
  }
  private authorized(auth: Awaited<ReturnType<EvidenceAuthorizationPort['authorize']>>,actor: EvidenceActor,resourceRef: string,permission: string): void {
    if (!auth.allowed) throw new EvidenceServiceError('EVIDENCE_AUTHORIZATION_DENIED');
    if (!nonBlank(auth.decisionRef) || auth.principalRef !== actor.principalRef || !sameTenant(auth.tenant,actor.tenant) || auth.resourceRef !== resourceRef || auth.permission !== permission || !nonBlank(auth.policyVersion) || !Number.isFinite(Date.parse(auth.decidedAt)) || Date.parse(auth.decidedAt) > Date.parse(this.clock())) throw new EvidenceServiceError('EVIDENCE_AUTHORIZATION_INVALID');
  }
  private clock(): string { return (this.ports.now ?? (()=>new Date().toISOString()))(); }
}
