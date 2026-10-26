import type { RecoveryRecord } from "./execution-recovery";

export interface ExecutionPersistenceStore {
  append(record: RecoveryRecord): Promise<void>;
  load(): Promise<RecoveryRecord[]>;
}

export class LedgerPersistenceAdapter {
  constructor(private readonly store: ExecutionPersistenceStore) {}

  async saveSnapshot(records: RecoveryRecord[]): Promise<void> {
    for (const record of records) await this.store.append(record);
  }

  async restore(): Promise<RecoveryRecord[]> {
    const records = await this.store.load();
    return records.map((record) => ({ ...record, receipt: { ...record.receipt } }));
  }
}

export class MemoryExecutionPersistenceStore implements ExecutionPersistenceStore {
  private readonly records: RecoveryRecord[] = [];

  async append(record: RecoveryRecord): Promise<void> {
    const existing = this.records[this.records.length - 1];
    if (existing && record.sequence <= existing.sequence) {
      throw new Error("Persistence sequence must increase");
    }
    this.records.push({ ...record, receipt: { ...record.receipt } });
  }

  async load(): Promise<RecoveryRecord[]> {
    return this.records.map((record) => ({ ...record, receipt: { ...record.receipt } }));
  }
}
