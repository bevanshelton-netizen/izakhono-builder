import type {
  AuditEvent,
  Clock,
  CreateVerificationInput,
  IdFactory,
  Principal,
  ProviderVerificationResult,
  VerificationProvider,
  VerificationRepository,
  VerificationRequest,
} from "./types.js";
import { requireTenantPermission, validatePurpose } from "./policy.js";
import { NoEligibleProviderError, ProviderRouter, type ProviderPreference } from "./provider-router.js";
import { assertVerificationTransition } from "./state-machine.js";

export class VerificationOrchestrator {
  constructor(
    private readonly repository: VerificationRepository,
    private readonly router: ProviderRouter,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly preferenceFor: (tenantId: string) => ProviderPreference,
  ) {}

  async create(
    principal: Principal,
    input: CreateVerificationInput,
    countryCode: string,
  ): Promise<VerificationRequest> {
    requireTenantPermission(principal, input.tenantId, "identity:verify:create");
    validatePurpose(input.purpose);
    if (!input.subjectRef.trim() || !input.idempotencyKey.trim()) {
      throw new Error("subjectRef and idempotencyKey are required");
    }
    const authorisation = input.processingAuthorisation;
    if (!authorisation?.legalBasis.trim() || !authorisation.noticeVersion.trim() || !authorisation.authorisationReference.trim()) {
      throw new Error("A recorded processing authorisation is required before verification");
    }
    const authorisedAt = new Date(authorisation.confirmedAt);
    if (!Number.isFinite(authorisedAt.getTime()) || authorisedAt > this.clock.now()) {
      throw new Error("Processing authorisation timestamp is invalid");
    }
    if (input.requiredChecks.length === 0) throw new Error("At least one verification check is required");
    const expiry = new Date(input.expiresAt);
    if (!Number.isFinite(expiry.getTime()) || expiry <= this.clock.now()) {
      throw new Error("expiresAt must be a valid future timestamp");
    }

    const prior = await this.repository.findByIdempotencyKey(input.tenantId, input.idempotencyKey);
    if (prior) return prior;

    const request: VerificationRequest = {
      id: this.ids.create(),
      tenantId: input.tenantId,
      subjectRef: input.subjectRef,
      purpose: input.purpose,
      requiredChecks: [...new Set(input.requiredChecks)],
      status: "created",
      legalBasis: authorisation.legalBasis,
      noticeVersion: authorisation.noticeVersion,
      authorisationReference: authorisation.authorisationReference,
      idempotencyKey: input.idempotencyKey,
      createdBy: principal.userId,
      createdAt: this.clock.now().toISOString(),
      updatedAt: this.clock.now().toISOString(),
      expiresAt: expiry.toISOString(),
    };
    await this.repository.createRequest(request);
    await this.audit(principal, request, "verification.created", "created");

    const preference = {
      ...this.preferenceFor(input.tenantId),
      requiredCountry: countryCode,
    };
    let startedSuccessfully = false;
    try {
      const candidates = this.router.selectCandidates(request, preference);
      for (const provider of candidates) {
        try {
          const started = await provider.start({
            requestId: request.id,
            tenantId: request.tenantId,
            purpose: request.purpose,
            requiredChecks: request.requiredChecks,
            countryCode,
            returnToken: this.ids.create(),
            idempotencyKey: request.idempotencyKey,
          });
          if (started.status === "started") {
            request.providerId = started.providerId;
            request.providerReference = started.providerReference;
            request.status = "in_progress";
            startedSuccessfully = true;
            break;
          }
        } catch {
          // Provider transport failure is isolated; continue to the next approved candidate.
        }
      }
    } catch (error) {
      if (!(error instanceof NoEligibleProviderError)) throw error;
    }
    if (!startedSuccessfully) request.status = "provider_unavailable";
    assertVerificationTransition("created", request.status);
    request.updatedAt = this.clock.now().toISOString();
    await this.repository.updateRequest(request);
    await this.audit(principal, request, "verification.provider_routing", request.status, {
      providerId: request.providerId ?? null,
    });
    return request;
  }

  async recordResult(
    principal: Principal,
    requestId: string,
    result: ProviderVerificationResult,
  ): Promise<VerificationRequest> {
    const request = await this.repository.findRequest(requestId);
    if (!request) throw new Error("Verification request not found");
    requireTenantPermission(principal, request.tenantId, "identity:verify:review");
    if (!request.providerId || !request.providerReference || request.providerId !== result.providerId || request.providerReference !== result.providerReference) {
      throw new Error("Provider result does not match the assigned verification");
    }
    if (["cancelled", "expired", "verified", "failed"].includes(request.status)) {
      throw new Error("Verification request is already terminal");
    }
    if (result.status === "verified" && !request.requiredChecks.every((check) => result.completedChecks.includes(check))) {
      throw new Error("Provider cannot mark verification successful until all required checks are complete");
    }
    if (result.status === "failed" && result.failedChecks.length === 0) {
      throw new Error("A failed verification must include at least one failed check");
    }
    assertVerificationTransition(request.status, result.status);
    request.status = result.status;
    request.updatedAt = this.clock.now().toISOString();
    await this.repository.updateRequest(request);
    await this.audit(principal, request, "verification.result_recorded", result.status, {
      providerId: result.providerId,
      reasonCodeCount: result.reasonCodes.length,
      completedCheckCount: result.completedChecks.length,
      failedCheckCount: result.failedChecks.length,
    });
    return request;
  }

  private async audit(
    principal: Principal,
    request: VerificationRequest,
    action: string,
    outcome: string,
    metadata: AuditEvent["metadata"] = {},
  ): Promise<void> {
    await this.repository.appendAudit({
      id: this.ids.create(),
      tenantId: request.tenantId,
      requestId: request.id,
      actorId: principal.userId,
      action,
      outcome,
      occurredAt: this.clock.now().toISOString(),
      correlationId: request.id,
      metadata,
    });
  }
}
