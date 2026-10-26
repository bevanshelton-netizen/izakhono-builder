import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AdapterInstruction } from "./adapter-execution";
import { ExecutionRuntime, type AdapterExecutor } from "./execution-runtime";
import { FileExecutionPersistenceStore } from "./file-execution-persistence";

const instruction: AdapterInstruction = {
  schema: "izakhono.marketing.adapter-instruction.v1",
  campaignId: "campaign-runtime-001",
  adapter: "owned",
  approvalId: "approval-runtime-001",
  issuedAt: "2026-10-27T08:00:00+02:00",
  jobs: [{
    campaignId: "campaign-runtime-001",
    network: "facebook",
    text: "Runtime test",
    scheduledAt: "2026-10-27T09:00:00+02:00",
    status: "ready_for_adapter",
  }],
};

const multiNetworkInstruction: AdapterInstruction = {
  ...instruction,
  campaignId: "campaign-runtime-multi-001",
  approvalId: "approval-runtime-multi-001",
  jobs: [
    { ...instruction.jobs[0], campaignId: "campaign-runtime-multi-001", network: "facebook" },
    { ...instruction.jobs[0], campaignId: "campaign-runtime-multi-001", network: "instagram" },
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

try {
  const store = new FileExecutionPersistenceStore(join(directory, "ledger.jsonl"));
  const runtime = await ExecutionRuntime.restore(
    store,
    new SequenceExecutor(),
    { maxAttempts: 3 },
    { now: () => "2026-10-27T08:30:00+02:00" },
  );

  const first = await runtime.run(instruction);
  if (first.receipts.length !== 1) throw new Error("Single-job execution must produce one receipt");
  if (first.receipts[0].result !== "retryable_failure") throw new Error("Initial runtime failure must be retryable");
  if (first.receipts[0].nextAction !== "retry") throw new Error("Retryable runtime failure must request replay");
  if (!first.durable) throw new Error("Runtime receipt must be durably persisted");

  let duplicateBlocked = false;
  try { await runtime.run(instruction); } catch { duplicateBlocked = true; }
  if (!duplicateBlocked) throw new Error("Runtime must block duplicate initial execution");

  const replay = await runtime.replay(first.receipts[0].idempotencyKey);
  if (replay.receipts[0].attempt !== 2) throw new Error("Replay must advance execution attempt");
  if (replay.receipts[0].result !== "success") throw new Error("Replay must record executor success");
  if (replay.receipts[0].nextAction !== "complete") throw new Error("Successful replay must complete");
  if (replay.receipts[0].recordedAt !== "2026-10-27T08:30:00+02:00") throw new Error("Runtime clock must be injectable");

  const restartedRuntime = await ExecutionRuntime.restore(
    store,
    new SequenceExecutor(),
    { maxAttempts: 3 },
    { now: () => "2026-10-27T08:45:00+02:00" },
  );
  let completedReplayBlocked = false;
  try { await restartedRuntime.replay(first.receipts[0].idempotencyKey); } catch { completedReplayBlocked = true; }
  if (!completedReplayBlocked) throw new Error("Restarted runtime must preserve completed execution state");

  const multiStore = new FileExecutionPersistenceStore(join(directory, "multi-ledger.jsonl"));
  const multiRuntime = await ExecutionRuntime.restore(multiStore, new SequenceExecutor(), { maxAttempts: 3 });
  const multi = await multiRuntime.run(multiNetworkInstruction);
  if (multi.receipts.length !== 2) throw new Error("Multi-network execution must produce one receipt per job");
  if (multi.receipts[0].idempotencyKey === multi.receipts[1].idempotencyKey) {
    throw new Error("Multi-network jobs must have independent idempotency keys");
  }
  if (multi.receipts[0].executionId === multi.receipts[1].executionId) {
    throw new Error("Multi-network jobs must have independent execution identities");
  }

  console.log("IZAKHONO MARKETING OS durable multi-network execution runtime contract validated");
} finally {
  await rm(directory, { recursive: true, force: true });
}
