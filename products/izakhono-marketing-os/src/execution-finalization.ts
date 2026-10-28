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
    validateFinalization(record);
    const existing = this.records.get(record.finalizationId);
    if (existing) {
      validateFinalization(existing);
      return;
    }
    this.records.set(record.finalizationId, structuredClone(record));
  }

  async commit(finalizationId: string, committedAt: string): Promise<void> {
    const record = this.records.get(finalizationId);
    if (!record) throw new Error("Finalization does not exist");
    if (record.status === "committed") return;
    const committed = { ...record, status: "committed" as const, committedAt };
    validateFinalization(committed);
    this.records.set(finalizationId, committed);
  }

  async load(): Promise<RecoveryFinalizationRecord[]> {
    return [...this.records.values()].map((record) => structuredClone(record));
  }
}

export function createFinalizationId(source: RecoveryRecord, target: RecoveryRecord): string {
  return `${source.receipt.executionId}:${source.receipt.idempotencyKey}:${source.sequence}->${target.sequence}:${target.receipt.recordedAt}:${target.receipt.nextAction}`;
}

export function validateFinalization(record: RecoveryFinalizationRecord): void {
  if (record.schema !== "izakhono.marketing.recovery-finalization.v1") throw new Error("Invalid finalization schema");
  if (!record.finalizationId || !record.preparedAt) throw new Error("Finalization metadata is required");
  if (record.source.receipt.idempotencyKey !== record.target.receipt.idempotencyKey) throw new Error("Finalization idempotency key mismatch");
  if (record.source.receipt.executionId !== record.target.receipt.executionId) throw new Error("Finalization execution identity mismatch");
  if (record.target.sequence !== record.source.sequence + 1) throw new Error("Finalization target sequence must follow source");
  if (record.journal.idempotencyKey !== record.target.receipt.idempotencyKey) throw new Error("Finalization journal identity mismatch");
  if (record.status === "committed" && !record.committedAt) throw new Error("Committed finalization requires committedAt");
}
