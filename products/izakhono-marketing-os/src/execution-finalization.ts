import type { RecoveryRecord } from "./execution-recovery";
import type { ReconciliationJournalEntry } from "./execution-reconciliation-journal";

export type FinalizationStatus = "prepared" | "committed";

export interface RecoveryFinalizationRecord {
  schema: "izakhono.marketing.recovery-finalization.v1";
  finalizationId: string;
  status: FinalizationStatus;
  source: RecoveryRecord;
  target: RecoveryRecord;
  journal: Omit<ReconciliationJournalEntry, "sequence">;
  preparedAt: string;
  committedAt?: string;
}

export interface FinalizationStore {
  prepare(record: RecoveryFinalizationRecord): Promise<void>;
  commit(finalizationId: string, committedAt: string): Promise<void>;
  load(): Promise<RecoveryFinalizationRecord[]>;
}

export class MemoryFinalizationStore implements FinalizationStore {
  private readonly records = new Map<string, RecoveryFinalizationRecord>();

  async prepare(record: RecoveryFinalizationRecord): Promise<void> {
    if (record.schema !== "izakhono.marketing.recovery-finalization.v1") throw new Error("Invalid finalization schema");
    if (!record.finalizationId || !record.source.receipt.executionId || !record.target.receipt.executionId) throw new Error("Finalization identity is required");
    if (this.records.has(record.finalizationId)) throw new Error("Finalization already exists");
    this.records.set(record.finalizationId, structuredClone(record));
  }

  async commit(finalizationId: string, committedAt: string): Promise<void> {
    const record = this.records.get(finalizationId);
    if (!record) throw new Error("Finalization does not exist");
    if (record.status === "committed") return;
    this.records.set(finalizationId, { ...record, status: "committed", committedAt });
  }

  async load(): Promise<RecoveryFinalizationRecord[]> {
    return [...this.records.values()].map((record) => structuredClone(record));
  }
}

export function createFinalizationId(source: RecoveryRecord, target: RecoveryRecord): string {
  return `${source.receipt.executionId}:${source.receipt.idempotencyKey}:${target.receipt.recordedAt}:${target.receipt.nextAction}`;
}

export function validateFinalization(record: RecoveryFinalizationRecord): void {
  if (record.schema !== "izakhono.marketing.recovery-finalization.v1") throw new Error("Invalid finalization schema");
  if (!record.finalizationId || !record.preparedAt) throw new Error("Finalization metadata is required");
  if (record.source.receipt.idempotencyKey !== record.target.receipt.idempotencyKey) throw new Error("Finalization idempotency key mismatch");
  if (record.source.receipt.executionId === record.target.receipt.executionId) throw new Error("Finalization must create a distinct target execution receipt");
  if (record.journal.idempotencyKey !== record.target.receipt.idempotencyKey) throw new Error("Finalization journal identity mismatch");
  if (record.status === "committed" && !record.committedAt) throw new Error("Committed finalization requires committedAt");
}
