import type { AdapterInstruction } from "./adapter-execution";
import { ExecutionRuntime, type AdapterExecutor } from "./execution-runtime";
import { PersistentExecutionLedger } from "./execution-recovery";

const instruction: AdapterInstruction = {
  schema: "izakhono.marketing.adapter-instruction.v1",
  campaignId: "campaign-runtime-001",
  adapter: "owned",
  approvalId: "approval-runtime-001",
  issuedAt: "2026-10-27T08:00:00+02:00",
  jobs: [
    {
      campaignId: "campaign-runtime-001",
      network: "facebook",
      text: "Runtime test",
      scheduledAt: "2026-10-27T09:00:00+02:00",
      status: "ready_for_adapter",
    },
  ],
};

class SequenceExecutor implements AdapterExecutor {
  private readonly results = ["retryable_failure", "success"] as const;
  private index = 0;

  execute(): "success" | "retryable_failure" | "permanent_failure" {
    const result = this.results[Math.min(this.index, this.results.length - 1)];
    this.index += 1;
    return result;
  }
}

const ledger = new PersistentExecutionLedger();
const runtime = new ExecutionRuntime(
  ledger,
  new SequenceExecutor(),
  { maxAttempts: 3 },
  { now: () => "2026-10-27T08:30:00+02:00" },
);

const first = runtime.run(instruction);
if (first.receipt.result !== "retryable_failure") throw new Error("Initial runtime failure must be retryable");
if (first.receipt.nextAction !== "retry") throw new Error("Retryable runtime failure must request replay");
if (!first.persisted) throw new Error("Runtime receipt must be persisted");

let duplicateBlocked = false;
try {
  runtime.run(instruction);
} catch {
  duplicateBlocked = true;
}
if (!duplicateBlocked) throw new Error("Runtime must block duplicate initial execution");

const replay = runtime.replay(first.receipt.idempotencyKey);
if (replay.receipt.attempt !== 2) throw new Error("Replay must advance execution attempt");
if (replay.receipt.result !== "success") throw new Error("Replay must record executor success");
if (replay.receipt.nextAction !== "complete") throw new Error("Successful replay must complete");
if (replay.receipt.recordedAt !== "2026-10-27T08:30:00+02:00") throw new Error("Runtime clock must be injectable");
if (ledger.snapshot().length !== 2) throw new Error("Runtime must preserve both execution attempts");

let replayBlocked = false;
try {
  runtime.replay(first.receipt.idempotencyKey);
} catch {
  replayBlocked = true;
}
if (!replayBlocked) throw new Error("Completed execution must not replay");

console.log("IZAKHONO MARKETING OS execution runtime contract validated");
