export type WebhookProvider = "IKHOKHA" | "STRIPE" | "PAYFAST" | "PAYSTACK" | "YOCO" | "OTHER";

export interface PaymentWebhook {
  eventId: string;
  tenantId: string;
  provider: WebhookProvider;
  signature: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface WebhookVerifier {
  verify(webhook: PaymentWebhook): Promise<boolean>;
}

export interface ProcessedEventStore {
  hasProcessed(eventKey: string): Promise<boolean>;
  recordProcessed(eventKey: string, receivedAt: string): Promise<void>;
}

export interface WebhookProcessingResult {
  accepted: boolean;
  duplicate: boolean;
  reason?: "INVALID_SIGNATURE" | "DUPLICATE_EVENT" | "INVALID_TENANT";
}

export async function processPaymentWebhook(
  webhook: PaymentWebhook,
  verifier: WebhookVerifier,
  processedEvents: ProcessedEventStore,
): Promise<WebhookProcessingResult> {
  if (!webhook.tenantId || !webhook.eventId) {
    return { accepted: false, duplicate: false, reason: "INVALID_TENANT" };
  }

  const valid = await verifier.verify(webhook);
  if (!valid) return { accepted: false, duplicate: false, reason: "INVALID_SIGNATURE" };

  const eventKey = `${webhook.tenantId}:${webhook.provider}:${webhook.eventId}`;
  if (await processedEvents.hasProcessed(eventKey)) {
    return { accepted: true, duplicate: true };
  }

  await processedEvents.recordProcessed(eventKey, webhook.receivedAt);
  return { accepted: true, duplicate: false };
}
