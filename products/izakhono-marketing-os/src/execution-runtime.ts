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
import {
  createExecutionLeaseOwnerId,
  MemoryExecutionLeaseStore,
  type ExecutionLease,
  type ExecutionLeaseStore,
} from "./execution-lease";

export interface AdapterExecutor {
  execute(instruction: AdapterInstruction | ReplayInstruction): ExecutionAttemptResult;
}

export interface ExecutionRuntimeClock {
  now(): string;
}

export interface RuntimeResult {
  receipts: ExecutionReceipt[];
  durable: boolean;
}

const systemClock: ExecutionRuntimeClock = {
  now: () => new Date().toISOString(),
};

const DEFAULT_LEASE_TTL_MS = 30_000;

export class ExecutionRuntime {
  constructor(
    private readonly ledger: PersistentExecutionLedger,
    private readonly executor: AdapterExecutor,
    private readonly retryPolicy: RetryPolicy,
    private readonly persistence: ExecutionPersistenceStore,
    private readonly clock: ExecutionRuntimeClock = systemClock,
    private readonly leaseStore: ExecutionLeaseStore = new MemoryExecutionLeaseStore(),
    private readonly leaseOwnerId: string = createExecutionLeaseOwnerId(),
    private readonly leaseTtlMs: number = DEFAULT_LEASE_TTL_MS,
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

  private async withLease<T>(key: string, work: () => Promise<T>): Promise<T> {
    const lease: ExecutionLease = await this.leaseStore.acquire(
      key,
      this.leaseOwnerId,
      this.clock.now(),
      this.leaseTtlMs,
    );
    try {
      return await work();
    } finally {
      await this.leaseStore.release(lease);
    }
  }

  async run(instruction: AdapterInstruction): Promise<RuntimeResult> {
    if (instruction.jobs.length === 0) throw new Error("Execution requires at least one job");

    const receipts: ExecutionReceipt[] = [];
    for (const job of instruction.jobs) {
      const key = createIdempotencyKey(
        instruction.campaignId,
        instruction.approvalId,
        job.network,
        job.scheduledAt,
      );

      const receipt = await this.withLease(key, async () => {
        if (this.ledger.latest(key)) throw new Error(`Execution already recorded: ${key}`);

        const result = this.executor.execute({ ...instruction, jobs: [job] });
        const nextReceipt = createExecutionReceipt(
          `${instruction.campaignId}:${instruction.approvalId}:${job.network}:${job.scheduledAt}`,
          instruction.campaignId,
          instruction.approvalId,
          key,
          1,
          result,
          instruction.issuedAt,
          instruction.adapter,
          this.retryPolicy,
        );
        await this.persistReceipt(nextReceipt);
        return nextReceipt;
      });
      receipts.push(receipt);
    }

    return { receipts, durable: true };
  }

  async replay(idempotencyKey: string): Promise<RuntimeResult> {
    return this.withLease(idempotencyKey, async () => {
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
      return { receipts: [receipt], durable: true };
    });
  }

  static async restore(
    persistence: ExecutionPersistenceStore,
    executor: AdapterExecutor,
    retryPolicy: RetryPolicy,
    clock: ExecutionRuntimeClock = systemClock,
    leaseStore: ExecutionLeaseStore = new MemoryExecutionLeaseStore(),
    leaseOwnerId: string = createExecutionLeaseOwnerId(),
    leaseTtlMs: number = DEFAULT_LEASE_TTL_MS,
  ): Promise<ExecutionRuntime> {
    const records = await persistence.load();
    const ledger = new PersistentExecutionLedger(records);
    return new ExecutionRuntime(ledger, executor, retryPolicy, persistence, clock, leaseStore, leaseOwnerId, leaseTtlMs);
  }
}
