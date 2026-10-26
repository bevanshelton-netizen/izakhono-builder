import type { AdapterInstruction } from "./adapter-execution";
import {
  createExecutionReceipt,
  createIdempotencyKey,
  type ExecutionAttemptResult,
  type ExecutionReceipt,
  type RetryPolicy,
} from "./execution-reliability";
import { PersistentExecutionLedger, type ReplayInstruction } from "./execution-recovery";
import type { ExecutionPersistenceStore } from "./execution-persistence";

export interface AdapterExecutor {
  execute(instruction: AdapterInstruction | ReplayInstruction): ExecutionAttemptResult;
}

export interface ExecutionRuntimeClock {
  now(): string;
}

export interface RuntimeResult {
  receipt: ExecutionReceipt;
  durable: boolean;
}

const systemClock: ExecutionRuntimeClock = {
  now: () => new Date().toISOString(),
};

export class ExecutionRuntime {
  constructor(
    private readonly ledger: PersistentExecutionLedger,
    private readonly executor: AdapterExecutor,
    private readonly retryPolicy: RetryPolicy,
    private readonly persistence: ExecutionPersistenceStore,
    private readonly clock: ExecutionRuntimeClock = systemClock,
  ) {}

  private async persistReceipt(receipt: ExecutionReceipt): Promise<void> {
    const sequence = this.ledger.snapshot().length + 1;
    await this.persistence.append({
      schema: "izakhono.marketing.recovery-record.v1",
      sequence,
      receipt: { ...receipt },
    });
    this.ledger.append(receipt);
  }

  async run(instruction: AdapterInstruction): Promise<RuntimeResult> {
    if (instruction.jobs.length === 0) throw new Error("Execution requires at least one job");
    const [firstJob] = instruction.jobs;
    const key = createIdempotencyKey(
      instruction.campaignId,
      instruction.approvalId,
      firstJob.network,
      firstJob.scheduledAt,
    );
    if (this.ledger.latest(key)) throw new Error("Execution already recorded");

    const result = this.executor.execute(instruction);
    const receipt = createExecutionReceipt(
      `${instruction.campaignId}:${instruction.approvalId}`,
      instruction.campaignId,
      instruction.approvalId,
      key,
      1,
      result,
      instruction.issuedAt,
      instruction.adapter,
      this.retryPolicy,
    );
    await this.persistReceipt(receipt);
    return { receipt, durable: true };
  }

  async replay(idempotencyKey: string): Promise<RuntimeResult> {
    const replay = this.ledger.buildReplay(idempotencyKey);
    const result = this.executor.execute(replay);
    const receipt = createExecutionReceipt(
      replay.executionId,
      replay.campaignId,
      replay.approvalId,
      replay.idempotencyKey,
      replay.attempt,
      result,
      this.clock.now(),
      replay.adapter,
      this.retryPolicy,
    );
    await this.persistReceipt(receipt);
    return { receipt, durable: true };
  }
}
