import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AdapterInstruction } from "./adapter-execution";
import { ExecutionRuntime } from "./execution-runtime";
import { FileExecutionPersistenceStore } from "./file-execution-persistence";
import { CredentialGatedProviderAdapter, ProviderAdapterRegistry } from "./provider-adapter";
import { ProviderBackedExecutionExecutor } from "./provider-runtime";

const instruction: AdapterInstruction = {
  schema: "izakhono.marketing.adapter-instruction.v1",
  campaignId: "campaign-provider-runtime-001",
  adapter: "owned",
  approvalId: "approval-provider-runtime-001",
  issuedAt: "2026-10-27T08:00:00+02:00",
  jobs: [{
    campaignId: "campaign-provider-runtime-001",
    network: "linkedin",
    text: "Provider runtime test",
    scheduledAt: "2026-10-27T09:00:00+02:00",
    status: "ready_for_adapter",
  }],
};

const registry = new ProviderAdapterRegistry();
let executions = 0;
let replays = 0;
registry.register(new CredentialGatedProviderAdapter(
  "owned",
  true,
  () => {
    executions += 1;
    return "retryable_failure";
  },
  () => {
    replays += 1;
    return "success";
  },
));

const directory = await mkdtemp(join(tmpdir(), "izakhono-provider-runtime-"));

try {
  const store = new FileExecutionPersistenceStore(join(directory, "ledger.jsonl"));
  const runtime = await ExecutionRuntime.restore(
    store,
    new ProviderBackedExecutionExecutor(registry),
    { maxAttempts: 3 },
    { now: () => "2026-10-27T08:30:00+02:00" },
  );

  const first = await runtime.run(instruction);
  if (executions !== 1) throw new Error("Provider-backed runtime must invoke the registered provider");
  if (first.receipts[0].result !== "retryable_failure") throw new Error("Provider result must become the durable runtime receipt");
  if (first.receipts[0].nextAction !== "retry") throw new Error("Retryable provider result must enter recovery state");

  const replay = await runtime.replay(first.receipts[0].idempotencyKey);
  if (replays !== 1) throw new Error("Provider-backed runtime must route replay through the registered provider");
  if (replay.receipts[0].attempt !== 2) throw new Error("Provider replay must preserve and advance recovery attempt");
  if (replay.receipts[0].result !== "success") throw new Error("Provider replay result must complete the execution");

  const restarted = await ExecutionRuntime.restore(
    store,
    new ProviderBackedExecutionExecutor(registry),
    { maxAttempts: 3 },
    { now: () => "2026-10-27T08:45:00+02:00" },
  );
  let completedBlocked = false;
  try { await restarted.replay(first.receipts[0].idempotencyKey); } catch { completedBlocked = true; }
  if (!completedBlocked) throw new Error("Restarted provider runtime must preserve completed execution state");

  const gatedRegistry = new ProviderAdapterRegistry();
  gatedRegistry.register(new CredentialGatedProviderAdapter("metricool", false, () => "success"));
  let credentialsBlocked = false;
  try { gatedRegistry.execute({ ...instruction, adapter: "metricool" }); } catch { credentialsBlocked = true; }
  if (!credentialsBlocked) throw new Error("Unconfigured provider credentials must remain blocked");

  console.log("IZAKHONO MARKETING OS provider-backed durable runtime and recovery contract validated");
} finally {
  await rm(directory, { recursive: true, force: true });
}
