import type { VerificationRepository, VerificationRequest, VerificationEvidenceMetadata, AuditEvent, ProviderVerificationResult } from "./types.js";

export class MemoryVerificationRepository implements VerificationRepository {
  readonly requests = new Map<string, VerificationRequest>();
  readonly audits: AuditEvent[] = [];
  readonly results: Array<{ requestId: string; result: ProviderVerificationResult }> = [];
  readonly evidence: VerificationEvidenceMetadata[] = [];

  async findByIdempotencyKey(tenantId: string, key: string): Promise<VerificationRequest | null> {
    const item = [...this.requests.values()].find(
      (request) => request.tenantId === tenantId && request.idempotencyKey === key,
    );
    return item ? structuredClone(item) : null;
  }

  async createRequest(request: VerificationRequest): Promise<void> {
    if (this.requests.has(request.id)) throw new Error("Duplicate request id");
    if (await this.findByIdempotencyKey(request.tenantId, request.idempotencyKey)) {
      throw new Error("Duplicate idempotency key");
    }
    this.requests.set(request.id, structuredClone(request));
  }

  async createEvidenceMetadata(metadata: VerificationEvidenceMetadata): Promise<void> {
    if (this.evidence.some((item) => item.requestId === metadata.requestId && item.contentSha256 === metadata.contentSha256)) {
      throw new Error("Duplicate evidence object");
    }
    this.evidence.push(structuredClone(metadata));
  }

  async updateRequest(request: VerificationRequest): Promise<void> {
    if (!this.requests.has(request.id)) throw new Error("Request not found");
    this.requests.set(request.id, structuredClone(request));
  }

  async persistProviderResult(request: VerificationRequest, result: ProviderVerificationResult): Promise<void> {
    if (!this.requests.has(request.id)) throw new Error("Request not found");
    this.requests.set(request.id, structuredClone(request));
    this.results.push({ requestId: request.id, result: structuredClone(result) });
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    this.audits.push(structuredClone(event));
  }

  async findRequest(id: string): Promise<VerificationRequest | null> {
    const item = this.requests.get(id);
    return item ? structuredClone(item) : null;
  }
}
