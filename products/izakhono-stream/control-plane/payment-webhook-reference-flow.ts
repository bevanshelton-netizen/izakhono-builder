import { processVerifiedPaymentToEntitlement } from "./webhook-entitlement-pipeline";

export async function referencePaymentWebhookFlow(
  webhook: Parameters<typeof processVerifiedPaymentToEntitlement>[0],
  verifier: Parameters<typeof processVerifiedPaymentToEntitlement>[1],
  processedEvents: Parameters<typeof processVerifiedPaymentToEntitlement>[2],
  entitlements: Parameters<typeof processVerifiedPaymentToEntitlement>[3],
  now: string,
) {
  return processVerifiedPaymentToEntitlement(
    webhook,
    verifier,
    processedEvents,
    entitlements,
    now,
  );
}

// Reference-only orchestration. Production must supply durable implementations.
