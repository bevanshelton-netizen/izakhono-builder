import type { AdapterInstruction } from "./adapter-execution";
import {
  createExecutionReceipt,
  createIdempotencyKey,
  type ExecutionAttemptResult,
  type ExecutionReceipt,
  type RetryPolicy,
} from "./execution-reliability";
import { PersistentExecutionLedger, type ReplayInstruction } from "./execution-recovery";

export interface AdapterExecutor {
  execute(instruction: AdapterInstruction | ReplayInstruction): ExecutionAttemptResult;
}

export interface ExecutionRuntimeClock {
  now(): string;
}

export interface RuntimeResult {
  receipt: ExecutionReceipt;
  persisted: boolean;
}

const systemClock: ExecutionRuntimeClock = {
  now: () => new Date().toISOString(),
};

export class ExecutionRuntime {
  constructor(
    private readonly ledger: PersistentExecutionLedger,
    private readonly executor: AdapterExecutor,
    private readonly retryPolicy: RetryPolicy,
    private readonly clock: ExecutionRuntimeClock = systemClock,
  ) {}

  run(instruction: AdapterInstruction): RuntimeResult {
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
    this.ledger.append(receipt);
    return { receipt, persisted: true };
  }

  replay(idempotencyKey: string): RuntimeResult {
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
    this.ledger.append(receipt);
    return { receipt, persisted: true };
  }
}
