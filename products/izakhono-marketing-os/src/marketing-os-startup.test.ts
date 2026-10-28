import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";
import { FileExecutionPersistenceStore } from "./file-execution-persistence";
import { runMarketingOsStartupRecovery, startMarketingOsRuntime } from "./marketing-os-startup";

const receipt: ExecutionReceipt = {
  schema: "izakhono.marketing.execution-receipt.v1",
  executionId: "exec-runtime-startup-1",
  campaignId: "campaign-runtime-startup-1",
  approvalId: "approval-runtime-startup-1",
  idempotencyKey: "campaign-runtime-startup-1:approval-runtime-startup-1:instagram:2026-10-28T04:00:00.000Z",
  attempt: 1,
  result: "retryable_failure",
  nextAction: "retry",
  adapter: "owned",
  issuedAt: "2026-10-28T04:00:00.000Z",
  recordedAt: "2026-10-28T04:00:01.000Z",
};

const record: RecoveryRecord = { schema: "izakhono.marketing.recovery-record.v1", sequence: 1, receipt };

const directory = await mkdtemp(join(resolve(process.cwd()), ".izakhono-marketing-startup-"));
const ledgerPath = join(directory, "execution-ledger.jsonl");
const journalPath = join(directory, "reconciliation-journal.jsonl");
const leaseDirectory = join(directory, "leases");

try {
  const store = new FileExecutionPersistenceStore(ledgerPath);
  await store.append(record);
  let providerCalls = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    providerCalls += 1;
    const body = JSON.parse(String(init?.body ?? "{}")) as { executionId: string; idempotencyKey: string };
    return new Response(JSON.stringify({
      executionId: body.executionId,
      idempotencyKey: body.idempotencyKey,
      observedAt: "2026-10-28T04:00:02.000Z",
      status: "success",
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const env = {
    IZAKHONO_EXECUTION_LEDGER_PATH: ledgerPath,
    IZAKHONO_RECONCILIATION_JOURNAL_PATH: journalPath,
    IZAKHONO_EXECUTION_LEASE_DIRECTORY: leaseDirectory,
    IZAKHONO_OWNED_NODE_OBSERVATION_ENDPOINT: "http://owned-node.test/observe",
    IZAKHONO_OWNED_NODE_OBSERVATION_TOKEN: "configured-token",
    METRICOOL_OBSERVATION_ENDPOINT: "http://metricool.test/observe",
    METRICOOL_OBSERVATION_TOKEN: "configured-token",
  };

  const first = await runMarketingOsStartupRecovery({ env, fetchImpl, ownerId: "runtime-startup-1" });
  assert.equal(first.acquired, true);
  assert.equal(first.candidates, 1);
  assert.equal(first.reconciled, 1);
  assert.equal(first.journalEntries[0]?.decision, "completed");
  assert.equal(providerCalls, 1);

  let started = false;
  const result = await startMarketingOsRuntime(async (recovery) => {
    started = true;
    return recovery.skippedPreviouslyCompleted;
  }, { env, fetchImpl, ownerId: "runtime-startup-2" });
  assert.equal(started, true);
  assert.equal(result, 1);
  assert.equal(providerCalls, 1);

  const journalText = await (await import("node:fs/promises")).readFile(journalPath, "utf8");
  assert.match(journalText, /provider_success/);
  assert.match(journalText, /completed/);

  let failedClosed = false;
  try {
    await runMarketingOsStartupRecovery({
      env: { ...env, IZAKHONO_OWNED_NODE_OBSERVATION_TOKEN: "" },
      fetchImpl,
      ownerId: "runtime-startup-fail-closed",
    });
  } catch {
    failedClosed = true;
  }
  assert.equal(failedClosed, true);
  assert.equal(providerCalls, 1);

  console.log("Marketing OS startup recovery boundary tests passed");
} finally {
  await rm(directory, { recursive: true, force: true });
}
