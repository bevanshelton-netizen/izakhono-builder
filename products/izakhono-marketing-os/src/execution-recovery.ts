import type { ExecutionReceipt } from "./execution-reliability";

export type RecoveryAction = "replay" | "complete" | "dead_letter";

export interface RecoveryRecord {
  schema: "izakhono.marketing.recovery-record.v1";
  sequence: number;
  receipt: ExecutionReceipt;
}

export interface ReplayInstruction {
  executionId: string;
  campaignId: string;
  approvalId: string;
  idempotencyKey: string;
  adapter: "metricool" | "owned";
  attempt: number;
}

export class PersistentExecutionLedger {
  private readonly records: RecoveryRecord[];

  constructor(records: RecoveryRecord[] = []) {
    this.records = records.map((record) => ({ ...record, receipt: { ...record.receipt } }));
    this.validateSequence();
  }

  append(receipt: ExecutionReceipt): RecoveryRecord {
    if (this.records.some((record) => record.receipt.idempotencyKey === receipt.idempotencyKey)) {
      throw new Error("Execution already exists in persistent ledger");
    }
    const record: RecoveryRecord = {
      schema: "izakhono.marketing.recovery-record.v1",
      sequence: this.records.length + 1,
      receipt: { ...receipt },
    };
    this.records.push(record);
    return { ...record, receipt: { ...record.receipt } };
  }

  snapshot(): RecoveryRecord[] {
    return this.records.map((record) => ({ ...record, receipt: { ...record.receipt } }));
  }

  latest(idempotencyKey: string): RecoveryRecord | undefined {
    const matches = this.records.filter((record) => record.receipt.idempotencyKey === idempotencyKey);
    const record = matches[matches.length - 1];
    return record ? { ...record, receipt: { ...record.receipt } } : undefined;
  }

  recoveryAction(idempotencyKey: string): RecoveryAction {
    const record = this.latest(idempotencyKey);
    if (!record) throw new Error("Execution is not recoverable because no ledger record exists");
    if (record.receipt.nextAction === "retry") return "replay";
    if (record.receipt.nextAction === "complete") return "complete";
    return "dead_letter";
  }

  buildReplay(idempotencyKey: string): ReplayInstruction {
    const record = this.latest(idempotencyKey);
    if (!record) throw new Error("Execution cannot be replayed without a ledger record");
    if (record.receipt.nextAction !== "retry") throw new Error("Only retryable executions may be replayed");
    return {
      executionId: record.receipt.executionId,
      campaignId: record.receipt.campaignId,
      approvalId: record.receipt.approvalId,
      idempotencyKey: record.receipt.idempotencyKey,
      adapter: record.receipt.adapter,
      attempt: record.receipt.attempt + 1,
    };
  }

  private validateSequence(): void {
    this.records.forEach((record, index) => {
      if (record.schema !== "izakhono.marketing.recovery-record.v1") throw new Error("Invalid recovery record schema");
      if (record.sequence !== index + 1) throw new Error("Recovery ledger sequence is not contiguous");
    });
  }
}
