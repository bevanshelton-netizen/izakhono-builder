import type { ExecutionObservation } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";
import { CredentialGatedProviderObservationAdapter } from "./provider-observation";

export type MetricoolExecutionStatus = "success" | "retryable_failure" | "permanent_failure" | "unknown";

export interface MetricoolObservationResponse {
  executionId: string;
  idempotencyKey: string;
  observedAt: string;
  status: MetricoolExecutionStatus;
}

export interface MetricoolObservationClient {
  observe(record: RecoveryRecord): Promise<MetricoolObservationResponse>;
}

export interface MetricoolHttpObservationConfig {
  endpoint: string;
  token: string;
  fetchImpl?: typeof fetch;
}

function validateEndpoint(endpoint: string): URL {
  const url = new URL(endpoint);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Metricool observation endpoint must use HTTP or HTTPS");
  return url;
}

function validateResponse(value: unknown): MetricoolObservationResponse {
  if (!value || typeof value !== "object") throw new Error("Metricool observation response is invalid");
  const response = value as Record<string, unknown>;
  if (typeof response.executionId !== "string" || !response.executionId) throw new Error("Metricool observation executionId is required");
  if (typeof response.idempotencyKey !== "string" || !response.idempotencyKey) throw new Error("Metricool observation idempotencyKey is required");
  if (typeof response.observedAt !== "string" || !response.observedAt) throw new Error("Metricool observation observedAt is required");
  if (!["success", "retryable_failure", "permanent_failure", "unknown"].includes(response.status as string)) {
    throw new Error("Metricool observation status is invalid");
  }
  return response as MetricoolObservationResponse;
}

export class HttpMetricoolObservationClient implements MetricoolObservationClient {
  private readonly endpoint: URL;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: MetricoolHttpObservationConfig) {
    if (!config.token.trim()) throw new Error("Metricool observation token is required");
    this.endpoint = validateEndpoint(config.endpoint);
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async observe(record: RecoveryRecord): Promise<MetricoolObservationResponse> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.config.token}`, "content-type": "application/json" },
      body: JSON.stringify({ executionId: record.receipt.executionId, idempotencyKey: record.receipt.idempotencyKey }),
    });
    if (!response.ok) throw new Error(`Metricool observation request failed with HTTP ${response.status}`);
    return validateResponse(await response.json());
  }
}

export function createMetricoolObservationAdapter(
  client: MetricoolObservationClient,
  configured = true,
): CredentialGatedProviderObservationAdapter {
  return new CredentialGatedProviderObservationAdapter("metricool", configured, async (record): Promise<ExecutionObservation> => {
    const observed = await client.observe(record);
    return {
      executionId: observed.executionId,
      idempotencyKey: observed.idempotencyKey,
      observedAt: observed.observedAt,
      providerResult: observed.status,
    };
  });
}
