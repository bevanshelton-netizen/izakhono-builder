import { authorize, type Principal } from "./auth";
import { SimulatorCarrier } from "./carrier";
import type { ProvisioningJob } from "./domain";
import { ProvisioningService } from "./provisioning";
import { MemoryProvisioningRepository, type ProvisioningRepository } from "./repository";

export type ApiRequest = {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  principal?: Principal;
};
export type ApiResponse = { status: number; data?: unknown; error?: { code: string; message: string }; request_id: string };

const carrier = new SimulatorCarrier();
const provisioning = new ProvisioningService(carrier);

const response = (requestId: string, status: number, data?: unknown, error?: { code: string; message: string }): ApiResponse => ({ status, data, error, request_id: requestId });

const errorResponse = (requestId: string, error: unknown): ApiResponse => {
  if (error instanceof Error) {
    if (error.message === "unauthenticated") return response(requestId, 401, undefined, { code: "unauthenticated", message: "authentication_required" });
    if (error.message === "tenant_scope_violation") return response(requestId, 403, undefined, { code: "tenant_scope_violation", message: "tenant_access_denied" });
    if (error.message === "forbidden") return response(requestId, 403, undefined, { code: "forbidden", message: "permission_denied" });
  }
  return response(requestId, 500, undefined, { code: "internal_error", message: "internal_error" });
};

export async function handleApi(
  request: ApiRequest,
  requestId = crypto.randomUUID(),
  repository: ProvisioningRepository = new MemoryProvisioningRepository(),
): Promise<ApiResponse> {
  const parts = request.path.replace(/^\/+|\/+$/g, "").split("/");
  if (parts[0] !== "v1") return response(requestId, 404, undefined, { code: "not_found", message: "route_not_found" });

  try {
    const body = request.body ?? {};
    const tenantId = String(body.tenant_id ?? request.principal?.tenantId ?? "");

    if (request.method === "POST" && parts.join("/") === "v1/provisioning") {
      authorize(request.principal, tenantId, "provision");
      const idempotencyKey = String(body.idempotency_key ?? "");
      if (!idempotencyKey) return response(requestId, 400, undefined, { code: "missing_idempotency_key", message: "idempotency_key_required" });
      const existing = await repository.findByIdempotencyKey(idempotencyKey, tenantId);
      if (existing) return response(requestId, 200, existing);
      const job: ProvisioningJob = { id: crypto.randomUUID(), tenantId, state: "REQUESTED", attempts: 0, updatedAt: new Date().toISOString() };
      await repository.create(job, idempotencyKey);
      return response(requestId, 201, job);
    }

    if (request.method === "GET" && parts[1] === "provisioning" && parts[2]) {
      authorize(request.principal, tenantId, "read");
      const job = await repository.get(parts[2], tenantId);
      return job ? response(requestId, 200, job) : response(requestId, 404, undefined, { code: "job_not_found", message: "provisioning_job_not_found" });
    }

    if (request.method === "POST" && parts[1] === "provisioning" && parts[2] && parts[3] === "advance") {
      authorize(request.principal, tenantId, "provision");
      const job = await repository.get(parts[2], tenantId);
      if (!job) return response(requestId, 404, undefined, { code: "job_not_found", message: "provisioning_job_not_found" });
      const next = await provisioning.advance(job, String(body.number ?? "+2701000000"), String(body.extension ?? "1001"));
      await repository.save(next, tenantId);
      return response(requestId, 200, next);
    }

    if (request.method === "GET" && parts.join("/") === "v1/numbers") {
      authorize(request.principal, tenantId, "read");
      const numbers = await carrier.searchNumbers(String(body.query ?? ""));
      return response(requestId, 200, numbers);
    }

    return response(requestId, 404, undefined, { code: "not_found", message: "route_not_found" });
  } catch (error) {
    return errorResponse(requestId, error);
  }
}
