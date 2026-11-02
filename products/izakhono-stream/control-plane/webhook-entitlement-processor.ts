import type { PaymentWebhook } from "./payment-webhook-verification";

export type EntitlementStatus = "ACTIVE" | "REVOKED";

export interface EntitlementRecord {
  entitlementId: string;
  tenantId: string;
  userId: string;
  productId: string;
  status: EntitlementStatus;
  sourceTransactionId: string;
  startsAt: string;
  endsAt?: string;
  provider: PaymentWebhook["provider"];
  updatedAt: string;
}

export interface EntitlementStore {
  upsert(record: EntitlementRecord): Promise<void>;
}

export function entitlementFromPaymentWebhook(
  webhook: PaymentWebhook,
  now: string,
): EntitlementRecord | null {
  const payload = webhook.payload;
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  const productId = typeof payload.productId === "string" ? payload.productId : "";
  const transactionId = typeof payload.transactionId === "string" ? payload.transactionId : "";
  const status = typeof payload.status === "string" ? payload.status : "";

  if (!userId || !productId || !transactionId) return null;

  return {
    entitlementId: `${webhook.tenantId}:${webhook.provider}:${transactionId}`,
    tenantId: webhook.tenantId,
    userId,
    productId,
    status: status === "PAID" ? "ACTIVE" : "REVOKED",
    sourceTransactionId: transactionId,
    startsAt: typeof payload.startsAt === "string" ? payload.startsAt : now,
    ...(typeof payload.endsAt === "string" ? { endsAt: payload.endsAt } : {}),
    provider: webhook.provider,
    updatedAt: now,
  };
}
