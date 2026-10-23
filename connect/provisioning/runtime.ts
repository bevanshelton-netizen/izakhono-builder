import type { PaymentEvent, OrchestrationResult } from "./orchestrator";
import { confirmPaymentIdempotently } from "./idempotent-payment";
import { createSupabaseConnectProvisioningRepositoryFromEnv } from "./supabase-repository";

export type ConnectRuntimeEnv = Record<string, string | undefined>;

/**
 * Server-only entry point for payment-confirmed CONNECT provisioning.
 *
 * A payment provider webhook/adapter should validate its own authenticity
 * before calling this boundary. This function deliberately accepts only the
 * normalized payment event and never exposes Supabase or provider secrets.
 */
export async function processConnectPaymentEvent(
  env: ConnectRuntimeEnv,
  event: PaymentEvent,
): Promise<OrchestrationResult> {
  validatePaymentEvent(event);

  const repository = createSupabaseConnectProvisioningRepositoryFromEnv(env);
  return confirmPaymentIdempotently(repository, event);
}

function validatePaymentEvent(event: PaymentEvent): void {
  if (!event || typeof event !== "object") {
    throw new Error("Invalid CONNECT payment event");
  }

  for (const [field, value] of [
    ["orderId", event.orderId],
    ["externalEventId", event.externalEventId],
    ["status", event.status],
  ] as const) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Invalid CONNECT payment event: ${field}`);
    }
  }

  if (event.amount != null && (!Number.isFinite(event.amount) || event.amount < 0)) {
    throw new Error("Invalid CONNECT payment event: amount");
  }

  if (event.currency != null && (typeof event.currency !== "string" || event.currency.length > 8)) {
    throw new Error("Invalid CONNECT payment event: currency");
  }
}
