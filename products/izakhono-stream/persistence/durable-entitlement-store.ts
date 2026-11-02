export type EntitlementStatus = "ACTIVE" | "REVOKED";
export type ProductType = "PLAN" | "ASSET" | "EVENT" | "CHANNEL";

export interface DurableWebhookEvent {
  tenantId: string;
  provider: string;
  eventId: string;
  signatureVerified: boolean;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface DurableEntitlement {
  id: string;
  tenantId: string;
  userId: string;
  productType: ProductType;
  productId: string;
  source: string;
  sourceEventId?: string;
  startsAt?: string;
  endsAt?: string;
  status: EntitlementStatus;
  metadata: Record<string, unknown>;
}

export interface WebhookReservation {
  inserted: boolean;
  eventId: string;
}

export interface DurableEntitlementStore {
  reserveWebhookEvent(event: DurableWebhookEvent): Promise<WebhookReservation>;
  markWebhookProcessed(tenantId: string, provider: string, eventId: string): Promise<void>;
  markWebhookFailed(tenantId: string, provider: string, eventId: string, errorCode: string): Promise<void>;
  upsertEntitlement(input: Omit<DurableEntitlement, "id">): Promise<DurableEntitlement>;
  revokeEntitlement(tenantId: string, userId: string, productType: ProductType, productId: string, source: string, reason: string): Promise<void>;
}

/**
 * Production boundary: implementations must execute webhook reservation,
 * entitlement mutation, and audit recording transactionally.
 *
 * The payment provider is never the source of truth. A verified event enters
 * this store exactly once per (tenant, provider, event_id), then mutates the
 * authoritative entitlement record. Duplicate deliveries become no-ops.
 */
export interface TransactionalDurableEntitlementStore extends DurableEntitlementStore {
  transaction<T>(work: (store: DurableEntitlementStore) => Promise<T>): Promise<T>;
}
