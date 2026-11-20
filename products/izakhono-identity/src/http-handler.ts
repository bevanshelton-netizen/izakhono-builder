import type { CreateVerificationInput, Principal, VerificationRepository } from "./types.js";
import { requireTenantPermission } from "./policy.js";
import { VerificationOrchestrator } from "./orchestrator.js";
import { ProviderRouter } from "./provider-router.js";
import { EvidenceService, type EvidenceKind } from "./evidence-service.js";

export interface IdentityHttpDependencies {
  authenticate(request: Request): Promise<Principal | null>;
  verifyRequestIntegrity(request: Request, principal: Principal): Promise<boolean>;
  resolveProcessingAuthorisation(input: {
    principal: Principal;
    tenantId: string;
    purpose: CreateVerificationInput["purpose"];
    reference: string;
  }): Promise<CreateVerificationInput["processingAuthorisation"] | null>;
  repository: VerificationRepository;
  orchestrator: VerificationOrchestrator;
  providerRouter: ProviderRouter;
  evidenceService: EvidenceService;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function publicRequest(record: Awaited<ReturnType<VerificationRepository["findRequest"]>>) {
  if (!record) return null;
  return {
    id: record.id, tenantId: record.tenantId, purpose: record.purpose,
    requiredChecks: record.requiredChecks, completedChecks: record.completedChecks,
    failedChecks: record.failedChecks, status: record.status,
    createdAt: record.createdAt, updatedAt: record.updatedAt, expiresAt: record.expiresAt,
  };
}

export function createIdentityHttpHandler(deps: IdentityHttpDependencies) {
  return async function handle(request: Request): Promise<Response> {
    const principal = await deps.authenticate(request);
    if (!principal) return json({ error: "unauthorized" }, 401);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);

    if (request.method === "POST" && path === "/v1/identity/verifications") {
      if (!(await deps.verifyRequestIntegrity(request, principal))) return json({ error: "request_integrity_check_failed" }, 403);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "invalid_json" }, 400); }

      const idempotencyKey = request.headers.get("idempotency-key") ?? "";
      if (idempotencyKey.length < 8 || idempotencyKey.length > 128) return json({ error: "invalid_idempotency_key" }, 400);
      const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
      const purpose = body.purpose as CreateVerificationInput["purpose"];
      const authorisationReference = typeof body.processingAuthorisationReference === "string" ? body.processingAuthorisationReference : "";
      if (!tenantId || !authorisationReference) return json({ error: "missing_required_fields" }, 400);

      try {
        requireTenantPermission(principal, tenantId, "identity:verify:create");
        const processingAuthorisation = await deps.resolveProcessingAuthorisation({
          principal, tenantId, purpose, reference: authorisationReference,
        });
        if (!processingAuthorisation) return json({ error: "processing_authorisation_not_found" }, 403);
        const input: CreateVerificationInput = {
          tenantId,
          subjectRef: String(body.subjectRef ?? ""),
          purpose,
          requiredChecks: Array.isArray(body.requiredChecks) ? body.requiredChecks as CreateVerificationInput["requiredChecks"] : [],
          countryCode: String(body.countryCode ?? ""),
          idempotencyKey,
          expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          processingAuthorisation,
        };
        const created = await deps.orchestrator.create(principal, input, input.countryCode);
        return json(publicRequest(created), created.status === "provider_unavailable" ? 503 : 201);
      } catch (error) {
        if (error instanceof Error && error.name === "AccessDeniedError") return json({ error: "forbidden" }, 403);
        return json({ error: "invalid_verification_request" }, 400);
      }
    }

    if (request.method === "POST" && path === "/v1/identity/evidence/upload-intents") {
      if (!(await deps.verifyRequestIntegrity(request, principal))) return json({ error: "request_integrity_check_failed" }, 403);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "invalid_json" }, 400); }
      try {
        const result = await deps.evidenceService.createUploadIntent(principal, {
          tenantId: String(body.tenantId ?? ""),
          requestId: String(body.requestId ?? ""),
          kind: body.kind as EvidenceKind,
          contentType: String(body.contentType ?? ""),
          sizeBytes: Number(body.sizeBytes),
        });
        return json(result, 201);
      } catch {
        return json({ error: "evidence_upload_intent_rejected" }, 400);
      }
    }

    if (segments.length === 6 && segments[0] === "v1" && segments[1] === "identity" && segments[2] === "evidence" && segments[3] === "upload-intents" && segments[5] === "finalise" && request.method === "POST") {
      if (!(await deps.verifyRequestIntegrity(request, principal))) return json({ error: "request_integrity_check_failed" }, 403);
      try {
        const metadata = await deps.evidenceService.finaliseUpload(principal, segments[4]);
        return json({
          id: metadata.id, requestId: metadata.requestId, kind: metadata.kind,
          contentSha256: metadata.contentSha256, capturedAt: metadata.capturedAt,
          retentionUntil: metadata.retentionUntil ?? null,
        }, 201);
      } catch {
        return json({ error: "evidence_finalisation_rejected" }, 400);
      }
    }

    if (request.method === "GET" && path === "/v1/providers") {
      return json(deps.providerRouter.list().map((provider) => ({ id: provider.id, enabled: provider.enabled, capabilities: provider.capabilities })));
    }

    if (segments.length === 4 && segments[0] === "v1" && segments[1] === "identity" && segments[2] === "verifications" && request.method === "GET") {
      const record = await deps.repository.findRequest(segments[3]);
      if (!record) return json({ error: "not_found" }, 404);
      try { requireTenantPermission(principal, record.tenantId, "identity:verify:read"); }
      catch { return json({ error: "not_found" }, 404); }
      return json(publicRequest(record));
    }

    if (segments.length === 5 && segments[0] === "v1" && segments[1] === "identity" && segments[2] === "verifications" && segments[4] === "review" && request.method === "POST") {
      if (!(await deps.verifyRequestIntegrity(request, principal))) return json({ error: "request_integrity_check_failed" }, 403);
      const record = await deps.repository.findRequest(segments[3]);
      if (!record) return json({ error: "not_found" }, 404);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "invalid_json" }, 400); }
      try {
        const decision = body.decision;
        if (decision !== "verified" && decision !== "failed") return json({ error: "invalid_review_decision" }, 400);
        const updated = await deps.orchestrator.recordManualReview(principal, record.id, decision, String(body.reasonCode ?? ""));
        return json(publicRequest(updated));
      } catch {
        return json({ error: "review_not_permitted_or_invalid" }, 403);
      }
    }

    return json({ error: "not_found" }, 404);
  };
}
