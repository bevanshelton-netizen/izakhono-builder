import { createHash } from "node:crypto";

export type ReplayStatus = "PENDING" | "APPROVED" | "REPLAYED" | "QUARANTINED";

export interface DeadLetterRecord {
  id: string;
  tenantId: string;
  deliveryId: string;
  originalAttempt: number;
  state: "DEAD_LETTER";
  reason: string;
  createdAt: string;
  payloadDigest: string;
  replayStatus: ReplayStatus;
  integrityHash: string;
}

export interface DeadLetterStore {
  put(record: DeadLetterRecord): void;
  get(tenantId: string, deliveryId: string): DeadLetterRecord | undefined;
  list(tenantId: string): DeadLetterRecord[];
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function unsigned(record: DeadLetterRecord): Omit<DeadLetterRecord, "integrityHash"> {
  const { integrityHash: _integrityHash, ...rest } = record;
  return rest;
}

export function deadLetterId(tenantId: string, deliveryId: string, payloadDigest: string): string {
  return digest({ tenantId, deliveryId, payloadDigest });
}

export function createDeadLetterRecord(input: Omit<DeadLetterRecord, "id" | "integrityHash" | "state" | "replayStatus">): DeadLetterRecord {
  const record = { ...input, id: deadLetterId(input.tenantId, input.deliveryId, input.payloadDigest), state: "DEAD_LETTER" as const, replayStatus: "PENDING" as const };
  return { ...record, integrityHash: digest(record) };
}

export function verifyDeadLetterRecord(record: DeadLetterRecord): boolean {
  return record.state === "DEAD_LETTER" && record.id === deadLetterId(record.tenantId, record.deliveryId, record.payloadDigest) && record.integrityHash === digest(unsigned(record));
}

export class InMemoryDeadLetterStore implements DeadLetterStore {
  private readonly records = new Map<string, DeadLetterRecord>();

  put(record: DeadLetterRecord): void {
    if (!record.tenantId || !record.deliveryId || !verifyDeadLetterRecord(record)) throw new Error("DEAD_LETTER_INVALID");
    const existing = this.records.get(record.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(record)) throw new Error("DEAD_LETTER_DUPLICATE_CONFLICT");
    this.records.set(record.id, { ...record });
  }

  get(tenantId: string, deliveryId: string): DeadLetterRecord | undefined {
    const found = [...this.records.values()].find((record) => record.tenantId === tenantId && record.deliveryId === deliveryId);
    return found ? { ...found } : undefined;
  }

  list(tenantId: string): DeadLetterRecord[] {
    return [...this.records.values()].filter((record) => record.tenantId === tenantId).map((record) => ({ ...record }));
  }
}
