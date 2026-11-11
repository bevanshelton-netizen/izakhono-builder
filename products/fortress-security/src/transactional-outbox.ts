import { createHash } from "node:crypto";

export type OutboxState = "PENDING" | "DISPATCHED" | "FAILED";

export interface OutboxEntry {
  id: string;
  tenantId: string;
  sequence: number;
  eventType: string;
  payload: unknown;
  state: OutboxState;
  createdAt: string;
  integrityHash: string;
}

export interface OutboxCommit {
  tenantId: string;
  expectedSequence: number;
  entries: OutboxEntry[];
  commitDigest: string;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function createOutboxEntry(input: Omit<OutboxEntry, "id" | "integrityHash">): OutboxEntry {
  const identity = { tenantId: input.tenantId, sequence: input.sequence, eventType: input.eventType, payload: input.payload, createdAt: input.createdAt };
  const id = digest(identity);
  return { ...input, id, integrityHash: digest({ id, ...identity }) };
}

export function validateOutboxCommit(commit: OutboxCommit): void {
  if (!commit.tenantId || !Number.isInteger(commit.expectedSequence) || commit.expectedSequence < 0) throw new Error("OUTBOX_INVALID_COMMIT");
  let expected = commit.expectedSequence + 1;
  const seen = new Set<string>();
  for (const entry of commit.entries) {
    if (entry.tenantId !== commit.tenantId) throw new Error("OUTBOX_TENANT_MISMATCH");
    if (entry.sequence !== expected++) throw new Error("OUTBOX_SEQUENCE_CONFLICT");
    if (seen.has(entry.id)) throw new Error("OUTBOX_DUPLICATE_ENTRY");
    seen.add(entry.id);
    const expectedIntegrity = digest({ id: entry.id, tenantId: entry.tenantId, sequence: entry.sequence, eventType: entry.eventType, payload: entry.payload, createdAt: entry.createdAt });
    if (entry.integrityHash !== expectedIntegrity) throw new Error("OUTBOX_INTEGRITY_MISMATCH");
    if (entry.state !== "PENDING") throw new Error("OUTBOX_INVALID_INITIAL_STATE");
  }
  if (digest(commit.entries) !== commit.commitDigest) throw new Error("OUTBOX_COMMIT_DIGEST_MISMATCH");
}

export function prepareOutboxCommit(tenantId: string, expectedSequence: number, entries: OutboxEntry[]): OutboxCommit {
  const commit = { tenantId, expectedSequence, entries: entries.map((entry) => ({ ...entry })), commitDigest: digest(entries) };
  validateOutboxCommit(commit);
  return commit;
}

export function markDispatched(entry: OutboxEntry): OutboxEntry {
  if (entry.state !== "PENDING") throw new Error("OUTBOX_NOT_PENDING");
  return { ...entry, state: "DISPATCHED" };
}

export function markFailed(entry: OutboxEntry): OutboxEntry {
  if (entry.state !== "PENDING") throw new Error("OUTBOX_NOT_PENDING");
  return { ...entry, state: "FAILED" };
}

export function verifyOutboxEntry(entry: OutboxEntry): boolean {
  try {
    const expected = digest({ id: entry.id, tenantId: entry.tenantId, sequence: entry.sequence, eventType: entry.eventType, payload: entry.payload, createdAt: entry.createdAt });
    return entry.integrityHash === expected;
  } catch { return false; }
}
