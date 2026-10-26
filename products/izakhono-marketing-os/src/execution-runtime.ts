import type { AdapterInstruction } from "./adapter-execution";
import {
  createExecutionReceipt,
  type ExecutionAttemptResult,
  type ExecutionReceipt,
  type RetryPolicy,
} from "./execution-reliability";
import { PersistentExecutionLedger, type ReplayInstruction } from "./execution-recovery";

export interface AdapterExecutor {
  execute(instruction: AdapterInstruction | ReplayInstruction): ExecutionAttemptResult;
}

export interface RuntimeResult {
  receipt: ExecutionReceipt;
  persisted: boolean;
}

export class ExecutionRuntime {
  constructor(
    private readonly ledger: PersistentExecutionLedger,
    private readonly executor: AdapterExecutor,
    private readonly retryPolicy: RetryPolicy,
  ) {}

  run(instruction: AdapterInstruction): RuntimeResult {
    if (instruction.jobs.length === 0) throw new Error("Execution requires at least one job");
    const key = instruction.jobs[0].campaignId + ":" + instruction.approvalId + ":" + instruction.jobs[0].network + ":" + instruction.jobs[0].scheduledAt;
    if (this.ledger.latest(key)) throw new Error("Execution already recorded");

    const result = this.executor.execute(instruction);
    const receipt = createExecutionReceipt(
      instruction.campaignId,
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
    const prior = this.ledger.latest(idempotencyKey);
    if (!prior) throw new Error("Replay source disappeared");
    const receipt = createExecutionReceipt(
      replay.executionId,
      replay.campaignId,
      replay.approvalId,
      replay.idempotencyKey,
      replay.attempt,
      result,
      new Date().toISOString(),
      replay.adapter,
      this.retryPolicy,
    );
    this.ledger.append(receipt);
    return { receipt, persisted: true };
  }
}
