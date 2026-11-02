import { processPaymentWebhook, type PaymentWebhook, type ProcessedEventStore, type WebhookVerifier } from "./payment-webhook-verification";
import { entitlementFromPaymentWebhook, type EntitlementStore } from "./webhook-entitlement-processor";

export async function processVerifiedPaymentToEntitlement(
  webhook: PaymentWebhook,
  verifier: WebhookVerifier,
  processedEvents: ProcessedEventStore,
  entitlements: EntitlementStore,
  now: string,
) {
  const result = await processPaymentWebhook(webhook, verifier, processedEvents);
  if (!result.accepted || result.duplicate) return result;

  const entitlement = entitlementFromPaymentWebhook(webhook, now);
  if (!entitlement) return { ...result, accepted: false as const, reason: "INVALID_TENANT" as const };

  await entitlements.upsert(entitlement);
  return { ...result, entitlementId: entitlement.entitlementId };
}
