import type { ExecutionObservation } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";
import { CredentialGatedProviderObservationAdapter } from "./provider-observation";

export type ProviderObservationStatus = "success" | "retryable_failure" | "permanent_failure" | "unknown";

export interface ProviderObservationResult {
  executionId: string;
  idempotencyKey: string;
  status: ProviderObservationStatus;
  observedAt?: string;
}

export interface OwnedNodeObservationClient {
  observeExecution(record: RecoveryRecord): Promise<ProviderObservationResult>;
}

export interface MetricoolObservationClient {
  observeExecution(record: RecoveryRecord): Promise<ProviderObservationResult>;
}

function toExecutionObservation(result: ProviderObservationResult): ExecutionObservation {
  if (!result.executionId || !result.idempotencyKey) {
    throw new Error("Provider observation must include execution identity");
  }
  return {
    executionId: result.executionId,
    idempotencyKey: result.idempotencyKey,
    providerResult: result.status,
    observedAt: result.observedAt ?? new Date().toISOString(),
  };
}

/**
 * Concrete owned-node observation boundary. The client owns the transport
 * details (local RPC, authenticated HTTP, queue lookup, etc.); this adapter
 * owns credential gating and the canonical observation shape.
 */
export function createOwnedNodeObservationAdapter(
  client: OwnedNodeObservationClient,
  configured = true,
): CredentialGatedProviderObservationAdapter {
  return new CredentialGatedProviderObservationAdapter(
    "owned",
    configured,
    async (record) => toExecutionObservation(await client.observeExecution(record)),
  );
}

/**
 * Concrete Metricool observation boundary. A real Metricool API client can be
 * injected without coupling the marketing runtime to HTTP or SDK details.
 */
export function createMetricoolObservationAdapter(
  client: MetricoolObservationClient,
  configured = true,
): CredentialGatedProviderObservationAdapter {
  return new CredentialGatedProviderObservationAdapter(
    "metricool",
    configured,
    async (record) => toExecutionObservation(await client.observeExecution(record)),
  );
}
