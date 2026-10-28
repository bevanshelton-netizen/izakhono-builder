import { createHash } from "node:crypto";
import { OutboxEntry, verifyOutboxEntry } from "./transactional-outbox";

export type DeliveryStatus = "READY" | "DELIVERED" | "RETRYABLE" | "QUARANTINED";

export interface DeliveryAdapter {
  readonly id: string;
  readonly supportedEventTypes: readonly string[];
  deliver(entry: OutboxEntry): DeliveryReceipt;
}

export interface DeliveryAttempt {
  readonly tenantId: string;
  readonly outboxEntryId: string;
  readonly adapterId: string;
  readonly attempt: number;
  readonly status: DeliveryStatus;
  readonly attemptedAt: string;
  readonly responseDigest?: string;
  readonly idempotencyKey: string;
}

export interface DeliveryReceipt {
  readonly tenantId: string;
  readonly outboxEntryId: string;
  readonly adapterId: string;
  readonly idempotencyKey: string;
  readonly status: "DELIVERED" | "RETRYABLE" | "QUARANTINED";
  readonly deliveredAt: string;
  readonly responseDigest: string;
  readonly receiptIntegrityHash: string;
}

export interface DispatchPolicy { readonly maxAttempts: number; }
export interface DispatchState { readonly attempts: readonly DeliveryAttempt[]; readonly receipts: readonly DeliveryReceipt[]; }

function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function canonical(value: unknown): string { return JSON.stringify(value); }

export function createIdempotencyKey(tenantId: string, outboxEntryId: string, adapterId: string): string {
  return sha256(canonical({ tenantId, outboxEntryId, adapterId }));
}

export function createReceiptIntegrityHash(receipt: Omit<DeliveryReceipt, "receiptIntegrityHash">): string {
  return sha256(canonical(receipt));
}

export function verifyDeliveryReceipt(receipt: DeliveryReceipt): boolean {
  if (!receipt.tenantId || !receipt.outboxEntryId || !receipt.adapterId || !receipt.idempotencyKey) return false;
  if (!Number.isFinite(Date.parse(receipt.deliveredAt))) return false;
  if (receipt.idempotencyKey !== createIdempotencyKey(receipt.tenantId, receipt.outboxEntryId, receipt.adapterId)) return false;
  const { receiptIntegrityHash, ...unsigned } = receipt;
  return receiptIntegrityHash === createReceiptIntegrityHash(unsigned);
}

export function dispatchOutboxEntry(entry: OutboxEntry, adapter: DeliveryAdapter, state: DispatchState, policy: DispatchPolicy, now = new Date().toISOString()): { attempt: DeliveryAttempt; receipt?: DeliveryReceipt; state: DispatchState } {
  if (!verifyOutboxEntry(entry)) throw new Error("OUTBOX_ENTRY_INTEGRITY_INVALID");
  if (entry.state !== "PENDING") throw new Error("OUTBOX_ENTRY_NOT_DISPATCHABLE");
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1) throw new Error("INVALID_DISPATCH_POLICY");
  if (!adapter.id || !(adapter.supportedEventTypes.includes(entry.eventType) || adapter.supportedEventTypes.includes("*"))) throw new Error("ADAPTER_UNSUPPORTED_EVENT");
  const key = createIdempotencyKey(entry.tenantId, entry.id, adapter.id);
  if (state.receipts.some((r) => r.idempotencyKey === key && r.status === "DELIVERED")) throw new Error("DUPLICATE_DELIVERY_SUPPRESSED");
  const attemptNo = state.attempts.filter((a) => a.idempotencyKey === key).length + 1;
  if (attemptNo > policy.maxAttempts) {
    const attempt: DeliveryAttempt = { tenantId: entry.tenantId, outboxEntryId: entry.id, adapterId: adapter.id, attempt: attemptNo, status: "QUARANTINED", attemptedAt: now, idempotencyKey: key };
    return { attempt, state: { attempts: [...state.attempts, attempt], receipts: state.receipts } };
  }
  const receipt = adapter.deliver(entry);
  if (receipt.tenantId !== entry.tenantId || receipt.outboxEntryId !== entry.id || receipt.adapterId !== adapter.id || !verifyDeliveryReceipt(receipt)) throw new Error("DELIVERY_RECEIPT_INTEGRITY_INVALID");
  const attempt: DeliveryAttempt = { tenantId: entry.tenantId, outboxEntryId: entry.id, adapterId: adapter.id, attempt: attemptNo, status: receipt.status, attemptedAt: now, responseDigest: receipt.responseDigest, idempotencyKey: key };
  return { attempt, receipt, state: { attempts: [...state.attempts, attempt], receipts: receipt.status === "DELIVERED" ? [...state.receipts, receipt] : state.receipts } };
}

export function createNoOpAdapter(id = "reference-no-op"): DeliveryAdapter {
  return {
    id,
    supportedEventTypes: ["*"],
    deliver(entry) {
      const unsigned: Omit<DeliveryReceipt, "receiptIntegrityHash"> = { tenantId: entry.tenantId, outboxEntryId: entry.id, adapterId: id, idempotencyKey: createIdempotencyKey(entry.tenantId, entry.id, id), status: "DELIVERED", deliveredAt: new Date().toISOString(), responseDigest: sha256(canonical({ entryId: entry.id, tenantId: entry.tenantId })) };
      return { ...unsigned, receiptIntegrityHash: createReceiptIntegrityHash(unsigned) };
    },
  };
}
