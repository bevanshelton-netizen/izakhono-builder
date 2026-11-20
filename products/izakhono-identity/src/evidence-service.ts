import type {
  Clock,
  IdFactory,
  Principal,
  VerificationEvidenceMetadata,
  VerificationRepository,
} from "./types.js";
import { requireTenantPermission } from "./policy.js";

export type EvidenceKind = VerificationEvidenceMetadata["kind"];

export interface EvidenceUploadIntent {
  id: string;
  tenantId: string;
  requestId: string;
  createdBy: string;
  kind: EvidenceKind;
  objectRef: string;
  contentType: string;
  maxBytes: number;
  expiresAt: string;
}

export interface EvidenceStorageAdapter {
  createPrivateUpload(input: {
    tenantId: string;
    requestId: string;
    kind: EvidenceKind;
    contentType: string;
    maxBytes: number;
    expiresAt: string;
  }): Promise<{ uploadUrl: string; objectRef: string }>;
  inspectPrivateObject(objectRef: string): Promise<{
    exists: boolean;
    contentType: string;
    sizeBytes: number;
    sha256: string;
  }>;
}

export interface EvidenceIntentStore {
  create(intent: EvidenceUploadIntent): Promise<void>;
  find(id: string): Promise<EvidenceUploadIntent | null>;
  markFinalizedOnce(id: string): Promise<boolean>;
}

const allowedTypes: Record<EvidenceKind, string[]> = {
  identity_document: ["image/jpeg", "image/png", "application/pdf"],
  selfie: ["image/jpeg", "image/png"],
  nfc_result: ["application/json"],
  provider_receipt: ["application/json"],
};

export class EvidenceService {
  constructor(
    private readonly repository: VerificationRepository,
    private readonly storage: EvidenceStorageAdapter,
    private readonly intents: EvidenceIntentStore,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly maxBytes = 15_000_000,
    private readonly intentLifetimeMs = 5 * 60 * 1000,
    private readonly retentionUntilFor: (tenantId: string, kind: EvidenceKind) => string | undefined = () => undefined,
  ) {}

  async createUploadIntent(
    principal: Principal,
    input: { tenantId: string; requestId: string; kind: EvidenceKind; contentType: string; sizeBytes: number },
  ): Promise<{ intentId: string; uploadUrl: string; expiresAt: string }> {
    requireTenantPermission(principal, input.tenantId, "identity:verify:create");
    const request = await this.repository.findRequest(input.requestId);
    if (!request || request.tenantId !== input.tenantId) throw new Error("Verification request not found");
    if (!["created", "in_progress", "manual_review"].includes(request.status)) {
      throw new Error("Evidence cannot be added to a terminal verification request");
    }
    if (!allowedTypes[input.kind]?.includes(input.contentType)) throw new Error("Evidence content type is not allowed");
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > this.maxBytes) {
      throw new Error("Evidence file size is outside the allowed range");
    }

    const expiresAt = new Date(this.clock.now().getTime() + this.intentLifetimeMs).toISOString();
    const signed = await this.storage.createPrivateUpload({
      tenantId: input.tenantId,
      requestId: input.requestId,
      kind: input.kind,
      contentType: input.contentType,
      maxBytes: Math.min(input.sizeBytes, this.maxBytes),
      expiresAt,
    });
    if (!signed.uploadUrl.startsWith("https://") || !signed.objectRef) {
      throw new Error("Evidence storage did not return a secure upload destination");
    }

    const intent: EvidenceUploadIntent = {
      id: this.ids.create(),
      tenantId: input.tenantId,
      requestId: input.requestId,
      createdBy: principal.userId,
      kind: input.kind,
      objectRef: signed.objectRef,
      contentType: input.contentType,
      maxBytes: Math.min(input.sizeBytes, this.maxBytes),
      expiresAt,
    };
    await this.intents.create(intent);
    return { intentId: intent.id, uploadUrl: signed.uploadUrl, expiresAt };
  }

  async finaliseUpload(principal: Principal, intentId: string): Promise<VerificationEvidenceMetadata> {
    const intent = await this.intents.find(intentId);
    if (!intent) throw new Error("Evidence upload intent not found");
    requireTenantPermission(principal, intent.tenantId, "identity:verify:create");
    if (new Date(intent.expiresAt) <= this.clock.now()) throw new Error("Evidence upload intent has expired");

    const object = await this.storage.inspectPrivateObject(intent.objectRef);
    if (!object.exists || object.contentType !== intent.contentType) throw new Error("Uploaded evidence is missing or has an invalid content type");
    if (!Number.isInteger(object.sizeBytes) || object.sizeBytes < 1 || object.sizeBytes > intent.maxBytes) {
      throw new Error("Uploaded evidence exceeds its approved size");
    }
    if (!/^[a-f0-9]{64}$/.test(object.sha256)) throw new Error("Evidence storage did not provide a valid SHA-256 digest");

    const metadata: VerificationEvidenceMetadata = {
      id: this.ids.create(),
      tenantId: intent.tenantId,
      requestId: intent.requestId,
      kind: intent.kind,
      objectRef: intent.objectRef,
      contentSha256: object.sha256,
      capturedAt: this.clock.now().toISOString(),
      retentionUntil: this.retentionUntilFor(intent.tenantId, intent.kind),
    };
    await this.repository.createEvidenceMetadata(metadata);
    if (!(await this.intents.markFinalizedOnce(intent.id))) throw new Error("Evidence upload intent was already finalised");
    return metadata;
  }
}
