export type PersistedPaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded";

export interface RentPaymentRecord {
  bookingId: string;
  provider: "ikhokha";
  providerReference?: string;
  providerEventId?: string;
  idempotencyKey: string;
  amount: number;
  currency: string;
  status: PersistedPaymentStatus;
  rawEventHash?: string;
}

export interface RentPaymentStore {
  createPending(payment: RentPaymentRecord): Promise<void>;
  applyVerifiedEvent(input: {
    provider: "ikhokha";
    providerReference: string;
    providerEventId: string;
    idempotencyKey: string;
    amount: number;
    currency: string;
    status: PersistedPaymentStatus;
    rawEventHash: string;
  }): Promise<"applied" | "duplicate">;
}

/**
 * Database adapter contract. The SQL migration provides the durable schema;
 * HTTP handlers should implement this interface with a server-side database
 * client so service credentials never reach the browser.
 */
export interface ServerPaymentPersistence {
  store: RentPaymentStore;
}
