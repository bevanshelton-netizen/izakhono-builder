import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AdapterInstruction } from "./adapter-execution";
import { ExecutionRuntime, type AdapterExecutor } from "./execution-runtime";
import { PersistentExecutionLedger } from "./execution-recovery";
import { FileExecutionPersistenceStore } from "./file-execution-persistence";

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

const directory = await mkdtemp(join(tmpdir(), "izakhono-runtime-"));
const path = join(directory, "ledger.jsonl");

try {
  const store = new FileExecutionPersistenceStore(path);
  const ledger = new PersistentExecutionLedger(await store.load());
  const runtime = new ExecutionRuntime(
    ledger,
    new SequenceExecutor(),
    { maxAttempts: 3 },
    store,
    { now: () => "2026-10-27T08:30:00+02:00" },
  );

  const first = await runtime.run(instruction);
  if (first.receipt.result !== "retryable_failure") throw new Error("Initial runtime failure must be retryable");
  if (first.receipt.nextAction !== "retry") throw new Error("Retryable runtime failure must request replay");
  if (!first.durable) throw new Error("Runtime receipt must be durably persisted");

  let duplicateBlocked = false;
  try {
    await runtime.run(instruction);
  } catch {
    duplicateBlocked = true;
  }
  if (!duplicateBlocked) throw new Error("Runtime must block duplicate initial execution");

  const replay = await runtime.replay(first.receipt.idempotencyKey);
  if (replay.receipt.attempt !== 2) throw new Error("Replay must advance execution attempt");
  if (replay.receipt.result !== "success") throw new Error("Replay must record executor success");
  if (replay.receipt.nextAction !== "complete") throw new Error("Successful replay must complete");
  if (replay.receipt.recordedAt !== "2026-10-27T08:30:00+02:00") throw new Error("Runtime clock must be injectable");
  if (ledger.snapshot().length !== 2) throw new Error("Runtime must preserve both execution attempts");

  const restartedLedger = new PersistentExecutionLedger(await store.load());
  const restartedRuntime = new ExecutionRuntime(
    restartedLedger,
    new SequenceExecutor(),
    { maxAttempts: 3 },
    store,
    { now: () => "2026-10-27T08:45:00+02:00" },
  );
  if (restartedLedger.snapshot().length !== 2) throw new Error("Restart must restore the durable ledger");

  let completedReplayBlocked = false;
  try {
    await restartedRuntime.replay(first.receipt.idempotencyKey);
  } catch {
    completedReplayBlocked = true;
  }
  if (!completedReplayBlocked) throw new Error("Restarted runtime must preserve completed execution state");

  console.log("IZAKHONO MARKETING OS durable execution runtime contract validated");
} finally {
  await rm(directory, { recursive: true, force: true });
}
