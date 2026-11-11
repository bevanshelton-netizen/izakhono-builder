export type PaymentStatus = "PAID" | "REFUNDED" | "CANCELLED" | "FAILED";
export type PaymentProvider = "IKHOKHA" | "STRIPE" | "PAYFAST" | "PAYSTACK" | "YOCO" | "OTHER";

export interface PaymentEvent {
  eventId: string;
  tenantId: string;
  provider: PaymentProvider;
  transactionId: string;
  userId: string;
  product: {
    type: "PLAN" | "ASSET" | "EVENT" | "CHANNEL";
    productId: string;
    currency: string;
    amount: number;
  };
  status: PaymentStatus;
  occurredAt: string;
  idempotencyKey?: string;
}

export interface EntitlementRecord {
  entitlementId: string;
  tenantId: string;
  userId: string;
  productId: string;
  status: "ACTIVE" | "REVOKED";
  sourceTransactionId: string;
  startsAt: string;
  endsAt?: string;
}

export interface EntitlementStore {
  findByIdempotencyKey(key: string): Promise<EntitlementRecord | null>;
  upsert(record: EntitlementRecord): Promise<EntitlementRecord>;
}

export interface PaymentEntitlementAdapter {
  apply(event: PaymentEvent): Promise<EntitlementRecord | null>;
}

export function createReferencePaymentEntitlementAdapter(store: EntitlementStore): PaymentEntitlementAdapter {
  return {
    async apply(event) {
      const key = event.idempotencyKey ?? `${event.provider}:${event.transactionId}:${event.status}`;
      const existing = await store.findByIdempotencyKey(key);
      if (existing) return existing;

      const active = event.status === "PAID";
      const entitlement: EntitlementRecord = {
        entitlementId: `ent_${event.tenantId}_${event.userId}_${event.product.productId}_${event.transactionId}`,
        tenantId: event.tenantId,
        userId: event.userId,
        productId: event.product.productId,
        status: active ? "ACTIVE" : "REVOKED",
        sourceTransactionId: event.transactionId,
        startsAt: event.occurredAt
      };

      return store.upsert(entitlement);
    }
  };
}
