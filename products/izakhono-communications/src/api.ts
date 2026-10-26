import { SimulatorCarrier } from "./carrier";
import type { ProvisioningJob } from "./domain";
import { ProvisioningService } from "./provisioning";

export type ApiRequest = { method: string; path: string; body?: Record<string, unknown> };
export type ApiResponse = { status: number; data?: unknown; error?: { code: string; message: string }; request_id: string };

const carrier = new SimulatorCarrier();
const provisioning = new ProvisioningService(carrier);
const jobs = new Map<string, ProvisioningJob>();

const response = (requestId: string, status: number, data?: unknown, error?: { code: string; message: string }): ApiResponse => ({ status, data, error, request_id: requestId });

export async function handleApi(request: ApiRequest, requestId = crypto.randomUUID()): Promise<ApiResponse> {
  const parts = request.path.replace(/^\/+|\/+$/g, "").split("/");
  if (parts[0] !== "v1") return response(requestId, 404, undefined, { code: "not_found", message: "route_not_found" });

  try {
    if (request.method === "POST" && parts.join("/") === "v1/provisioning") {
      const body = request.body ?? {};
      const idempotencyKey = String(body.idempotency_key ?? "");
      if (!idempotencyKey) return response(requestId, 400, undefined, { code: "missing_idempotency_key", message: "idempotency_key_required" });
      const existing = [...jobs.values()].find((job) => job.id === idempotencyKey);
      if (existing) return response(requestId, 200, existing);
      const job: ProvisioningJob = { id: idempotencyKey, tenantId: String(body.tenant_id ?? ""), state: "REQUESTED", attempts: 0, updatedAt: new Date().toISOString() };
      jobs.set(job.id, job);
      return response(requestId, 201, job);
    }

    if (request.method === "GET" && parts[1] === "provisioning" && parts[2]) {
      const job = jobs.get(parts[2]);
      return job ? response(requestId, 200, job) : response(requestId, 404, undefined, { code: "job_not_found", message: "provisioning_job_not_found" });
    }

    if (request.method === "POST" && parts[1] === "provisioning" && parts[2] && parts[3] === "advance") {
      const job = jobs.get(parts[2]);
      if (!job) return response(requestId, 404, undefined, { code: "job_not_found", message: "provisioning_job_not_found" });
      const body = request.body ?? {};
      const next = await provisioning.advance(job, String(body.number ?? "+2701000000"), String(body.extension ?? "1001"));
      jobs.set(next.id, next);
      return response(requestId, 200, next);
    }

    if (request.method === "GET" && parts.join("/") === "v1/numbers") {
      const numbers = await carrier.searchNumbers(String((request.body ?? {}).query ?? ""));
      return response(requestId, 200, numbers);
    }

    return response(requestId, 404, undefined, { code: "not_found", message: "route_not_found" });
  } catch {
    return response(requestId, 500, undefined, { code: "internal_error", message: "internal_error" });
  }
}
