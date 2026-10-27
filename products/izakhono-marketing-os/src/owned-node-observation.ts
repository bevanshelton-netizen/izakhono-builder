import type { ExecutionObservation } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";
import { CredentialGatedProviderObservationAdapter } from "./provider-observation";

export type OwnedNodeExecutionStatus = "success" | "retryable_failure" | "permanent_failure" | "unknown";

export interface OwnedNodeObservationResponse {
  executionId: string;
  idempotencyKey: string;
  observedAt: string;
  status: OwnedNodeExecutionStatus;
}

export interface OwnedNodeObservationClient {
  observe(record: RecoveryRecord): Promise<OwnedNodeObservationResponse>;
}

export interface OwnedNodeHttpObservationConfig {
  endpoint: string;
  token: string;
  fetchImpl?: typeof fetch;
}

function validateEndpoint(endpoint: string): URL {
  const url = new URL(endpoint);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Owned-node observation endpoint must use HTTP or HTTPS");
  return url;
}

function validateResponse(value: unknown): OwnedNodeObservationResponse {
  if (!value || typeof value !== "object") throw new Error("Owned-node observation response is invalid");
  const response = value as Record<string, unknown>;
  if (typeof response.executionId !== "string" || !response.executionId) throw new Error("Owned-node observation executionId is required");
  if (typeof response.idempotencyKey !== "string" || !response.idempotencyKey) throw new Error("Owned-node observation idempotencyKey is required");
  if (typeof response.observedAt !== "string" || !response.observedAt) throw new Error("Owned-node observation observedAt is required");
  if (!["success", "retryable_failure", "permanent_failure", "unknown"].includes(response.status as string)) {
    throw new Error("Owned-node observation status is invalid");
  }
  return response as OwnedNodeObservationResponse;
}

export class HttpOwnedNodeObservationClient implements OwnedNodeObservationClient {
  private readonly endpoint: URL;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: OwnedNodeHttpObservationConfig) {
    if (!config.token.trim()) throw new Error("Owned-node observation token is required");
    this.endpoint = validateEndpoint(config.endpoint);
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async observe(record: RecoveryRecord): Promise<OwnedNodeObservationResponse> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.config.token}`, "content-type": "application/json" },
      body: JSON.stringify({ executionId: record.receipt.executionId, idempotencyKey: record.receipt.idempotencyKey }),
    });
    if (!response.ok) throw new Error(`Owned-node observation request failed with HTTP ${response.status}`);
    return validateResponse(await response.json());
  }
}

export function createOwnedNodeObservationAdapter(
  client: OwnedNodeObservationClient,
  configured = true,
): CredentialGatedProviderObservationAdapter {
  return new CredentialGatedProviderObservationAdapter("owned", configured, async (record): Promise<ExecutionObservation> => {
    const observed = await client.observe(record);
    return {
      executionId: observed.executionId,
      idempotencyKey: observed.idempotencyKey,
      observedAt: observed.observedAt,
      providerResult: observed.status,
    };
  });
}
