export type VerificationStatus =
  | "created"
  | "consent_pending"
  | "in_progress"
  | "verified"
  | "failed"
  | "manual_review"
  | "provider_unavailable"
  | "expired"
  | "cancelled";

export type VerificationPurpose =
  | "customer_onboarding"
  | "business_onboarding"
  | "employment"
  | "supplier_onboarding"
  | "account_recovery"
  | "regulated_service";

export type VerificationCheck =
  | "document_authenticity"
  | "document_data"
  | "face_match"
  | "liveness"
  | "nfc_chip";

export type ProviderId = string;

export interface ProcessingAuthorisation {
  legalBasis: string;
  noticeVersion: string;
  authorisationReference: string;
  confirmedAt: string;
}

export interface VerificationRequest {
  id: string;
  tenantId: string;
  subjectRef: string;
  purpose: VerificationPurpose;
  requiredChecks: VerificationCheck[];
  status: VerificationStatus;
  legalBasis: string;
  noticeVersion: string;
  authorisationReference: string;
  providerId?: ProviderId;
  providerReference?: string;
  idempotencyKey: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface VerificationEvidenceMetadata {
  id: string;
  requestId: string;
  kind: "identity_document" | "selfie" | "nfc_result" | "provider_receipt";
  objectRef: string;
  contentSha256: string;
  capturedAt: string;
  retentionUntil?: string;
}

export interface ProviderVerificationResult {
  providerId: ProviderId;
  providerReference: string;
  status: "verified" | "failed" | "manual_review" | "provider_unavailable";
  completedChecks: VerificationCheck[];
  failedChecks: VerificationCheck[];
  confidence?: number;
  reasonCodes: string[];
  completedAt: string;
  evidenceDigest?: string;
}

export interface ProviderCapabilities {
  checks: VerificationCheck[];
  countries: string[];
  documentTypes: string[];
  supportsWebhook: boolean;
  supportsNfc: boolean;
}

export interface ProviderStartInput {
  requestId: string;
  tenantId: string;
  purpose: VerificationPurpose;
  requiredChecks: VerificationCheck[];
  countryCode: string;
  returnToken: string;
  idempotencyKey: string;
}

export interface ProviderStartResult {
  providerId: ProviderId;
  providerReference: string;
  redirectUrl?: string;
  status: "started" | "provider_unavailable";
}

export interface VerificationProvider {
  readonly id: ProviderId;
  readonly enabled: boolean;
  readonly capabilities: ProviderCapabilities;
  start(input: ProviderStartInput): Promise<ProviderStartResult>;
  parseResult(payload: unknown): ProviderVerificationResult;
}

export interface Principal {
  userId: string;
  roles: string[];
  tenantMemberships: Array<{
    tenantId: string;
    permissions: string[];
    status: "active" | "suspended";
  }>;
}

export interface CreateVerificationInput {
  tenantId: string;
  subjectRef: string;
  purpose: VerificationPurpose;
  requiredChecks: VerificationCheck[];
  countryCode: string;
  idempotencyKey: string;
  expiresAt: string;
  processingAuthorisation: ProcessingAuthorisation;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  requestId?: string;
  actorId: string;
  action: string;
  outcome: string;
  occurredAt: string;
  correlationId: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface VerificationRepository {
  findByIdempotencyKey(tenantId: string, key: string): Promise<VerificationRequest | null>;
  createRequest(request: VerificationRequest): Promise<void>;
  updateRequest(request: VerificationRequest): Promise<void>;
  appendAudit(event: AuditEvent): Promise<void>;
  findRequest(id: string): Promise<VerificationRequest | null>;
}

export interface Clock {
  now(): Date;
}

export interface IdFactory {
  create(): string;
}
