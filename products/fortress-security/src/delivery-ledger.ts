import { createHash } from "node:crypto";

export type LedgerStatus = "READY" | "LEASED" | "DELIVERED" | "RETRYABLE" | "QUARANTINED";

export interface DeliveryLedgerRecord {
  tenantId: string;
  outboxEntryId: string;
  adapterId: string;
  status: LedgerStatus;
  attemptCount: number;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  updatedAt: string;
  integrityHash: string;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createLedgerRecord(input: Omit<DeliveryLedgerRecord, "integrityHash">): DeliveryLedgerRecord {
  return { ...input, integrityHash: digest(input) };
}

export function verifyLedgerRecord(record: DeliveryLedgerRecord): boolean {
  const { integrityHash, ...unsigned } = record;
  return integrityHash === digest(unsigned);
}

export interface WorkerLease {
  readonly tenantId: string;
  readonly outboxEntryId: string;
  readonly adapterId: string;
  readonly owner: string;
  readonly expiresAt: string;
}

export function acquireLease(record: DeliveryLedgerRecord, owner: string, now: string, leaseMs: number): DeliveryLedgerRecord {
  if (!verifyLedgerRecord(record)) throw new Error("DELIVERY_LEDGER_INTEGRITY_INVALID");
  if (!owner || !Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("INVALID_WORKER_LEASE");
  const active = record.leaseExpiresAt && Date.parse(record.leaseExpiresAt) > Date.parse(now);
  if (record.status === "DELIVERED" || record.status === "QUARANTINED") throw new Error("DELIVERY_NOT_LEASABLE");
  if (active && record.leaseOwner !== owner) throw new Error("DELIVERY_LEASE_HELD");
  const next = { ...record, status: "LEASED" as const, leaseOwner: owner, leaseExpiresAt: new Date(Date.parse(now) + leaseMs).toISOString(), updatedAt: now };
  return createLedgerRecord(next);
}

export function releaseExpiredLease(record: DeliveryLedgerRecord, now: string): DeliveryLedgerRecord {
  if (!verifyLedgerRecord(record)) throw new Error("DELIVERY_LEDGER_INTEGRITY_INVALID");
  if (record.status !== "LEASED" || !record.leaseExpiresAt || Date.parse(record.leaseExpiresAt) > Date.parse(now)) return record;
  return createLedgerRecord({ ...record, status: "READY", leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt: now });
}

export function releaseLease(record: DeliveryLedgerRecord, owner: string, now: string): DeliveryLedgerRecord {
  if (!verifyLedgerRecord(record)) throw new Error("DELIVERY_LEDGER_INTEGRITY_INVALID");
  if (record.status !== "LEASED" || record.leaseOwner !== owner) throw new Error("DELIVERY_LEASE_OWNER_MISMATCH");
  return createLedgerRecord({ ...record, status: "READY", leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt: now });
}

export function markLedgerDelivery(record: DeliveryLedgerRecord, owner: string, status: "DELIVERED" | "RETRYABLE" | "QUARANTINED", now: string): DeliveryLedgerRecord {
  if (!verifyLedgerRecord(record)) throw new Error("DELIVERY_LEDGER_INTEGRITY_INVALID");
  if (record.status !== "LEASED" || record.leaseOwner !== owner) throw new Error("DELIVERY_LEASE_OWNER_MISMATCH");
  return createLedgerRecord({ ...record, status, attemptCount: record.attemptCount + 1, leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt: now });
}
