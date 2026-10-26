import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";

export interface ExecutionStoreSnapshot {
  schema: "izakhono.marketing.execution-store.v1";
  version: number;
  records: RecoveryRecord[];
}

export interface ExecutionStore {
  load(): ExecutionStoreSnapshot;
  append(receipt: ExecutionReceipt, expectedVersion: number): ExecutionStoreSnapshot;
}

function cloneSnapshot(snapshot: ExecutionStoreSnapshot): ExecutionStoreSnapshot {
  return {
    schema: snapshot.schema,
    version: snapshot.version,
    records: snapshot.records.map((record) => ({
      ...record,
      receipt: { ...record.receipt },
    })),
  };
}

export class InMemoryExecutionStore implements ExecutionStore {
  private snapshot: ExecutionStoreSnapshot;

  constructor(initial?: ExecutionStoreSnapshot) {
    this.snapshot = initial
      ? cloneSnapshot(initial)
      : { schema: "izakhono.marketing.execution-store.v1", version: 0, records: [] };
    this.validateSnapshot(this.snapshot);
  }

  load(): ExecutionStoreSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  append(receipt: ExecutionReceipt, expectedVersion: number): ExecutionStoreSnapshot {
    if (expectedVersion !== this.snapshot.version) {
      throw new Error("Execution store version conflict");
    }
    if (this.snapshot.records.some((record) => record.receipt.idempotencyKey === receipt.idempotencyKey)) {
      throw new Error("Execution already exists in execution store");
    }

    const next: ExecutionStoreSnapshot = {
      schema: "izakhono.marketing.execution-store.v1",
      version: this.snapshot.version + 1,
      records: [
        ...this.snapshot.records,
        {
          schema: "izakhono.marketing.recovery-record.v1",
          sequence: this.snapshot.records.length + 1,
          receipt: { ...receipt },
        },
      ],
    };
    this.validateSnapshot(next);
    this.snapshot = next;
    return cloneSnapshot(this.snapshot);
  }

  private validateSnapshot(snapshot: ExecutionStoreSnapshot): void {
    if (snapshot.schema !== "izakhono.marketing.execution-store.v1") {
      throw new Error("Invalid execution store schema");
    }
    if (!Number.isInteger(snapshot.version) || snapshot.version < 0) {
      throw new Error("Invalid execution store version");
    }
    snapshot.records.forEach((record, index) => {
      if (record.schema !== "izakhono.marketing.recovery-record.v1") {
        throw new Error("Invalid recovery record schema");
      }
      if (record.sequence !== index + 1) {
        throw new Error("Execution store sequence is not contiguous");
      }
    });
    if (snapshot.version !== snapshot.records.length) {
      throw new Error("Execution store version must equal record count");
    }
  }
}
