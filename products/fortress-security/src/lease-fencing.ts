import { createHash } from "node:crypto";

export type RetryState = "READY" | "RETRY_SCHEDULED" | "DEAD_LETTER";

export interface LeaseToken {
  tenantId: string;
  deliveryId: string;
  workerId: string;
  generation: number;
  acquiredAt: string;
  expiresAt: string;
  integrityHash: string;
}

export interface RetryRecord {
  tenantId: string;
  deliveryId: string;
  attempt: number;
  state: RetryState;
  nextAttemptAt: string;
  reason: string;
  integrityHash: string;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createLeaseToken(input: Omit<LeaseToken, "integrityHash">): LeaseToken {
  return { ...input, integrityHash: digest(input) };
}

export function verifyLeaseToken(token: LeaseToken, now = new Date().toISOString()): boolean {
  const { integrityHash, ...unsigned } = token;
  return token.tenantId.length > 0 && token.deliveryId.length > 0 && token.workerId.length > 0 && token.generation > 0 && Date.parse(token.expiresAt) > Date.parse(now) && integrityHash === digest(unsigned);
}

export function fenceLease(token: LeaseToken, workerId: string, generation: number, now = new Date().toISOString()): void {
  if (!verifyLeaseToken(token, now)) throw new Error("LEASE_INVALID_OR_EXPIRED");
  if (token.workerId !== workerId) throw new Error("LEASE_OWNER_MISMATCH");
  if (token.generation !== generation) throw new Error("LEASE_FENCING_TOKEN_STALE");
}

export function scheduleRetry(tenantId: string, deliveryId: string, attempt: number, reason: string, now = new Date().toISOString(), baseDelayMs = 1000): RetryRecord {
  if (!tenantId || !deliveryId || !Number.isInteger(attempt) || attempt < 1) throw new Error("RETRY_INVALID_INPUT");
  const delay = Math.min(60 * 60 * 1000, baseDelayMs * 2 ** Math.min(attempt - 1, 10));
  const record = { tenantId, deliveryId, attempt, state: "RETRY_SCHEDULED" as const, nextAttemptAt: new Date(Date.parse(now) + delay).toISOString(), reason };
  return { ...record, integrityHash: digest(record) };
}

export function moveToDeadLetter(record: RetryRecord, maxAttempts: number): RetryRecord {
  if (record.attempt < maxAttempts) throw new Error("RETRY_LIMIT_NOT_REACHED");
  const next = { ...record, state: "DEAD_LETTER" as const };
  const { integrityHash, ...unsigned } = next;
  return { ...next, integrityHash: digest(unsigned) };
}

export function verifyRetryRecord(record: RetryRecord): boolean {
  const { integrityHash, ...unsigned } = record;
  return integrityHash === digest(unsigned);
}
