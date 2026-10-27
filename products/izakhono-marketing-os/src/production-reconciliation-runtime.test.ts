import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";
import { reconcileProductionExecution } from "./production-reconciliation-runtime";

const root = await mkdtemp(join(tmpdir(), "izakhono-production-reconciliation-"));
const journalPath = join(process.cwd(), `.izakhono-production-reconciliation-${Date.now()}.ndjson`);
const receipt: ExecutionReceipt = {
  schema: "izakhono.marketing.execution-receipt.v1",
  executionId: "exec-prod-1",
  campaignId: "campaign-prod-1",
  approvalId: "approval-prod-1",
  idempotencyKey: "campaign-prod-1:approval-prod-1:instagram:2026-10-27T10:00:00.000Z",
  attempt: 1,
  result: "retryable_failure",
  nextAction: "retry",
  adapter: "owned",
  issuedAt: "2026-10-27T10:00:00.000Z",
  recordedAt: "2026-10-27T10:00:01.000Z",
};
const record: RecoveryRecord = {
  schema: "izakhono.marketing.recovery-record.v1",
  sequence: 1,
  receipt,
};

try {
  const result = await reconcileProductionExecution(
    record,
    {
      idempotencyKey: receipt.idempotencyKey,
      executionId: receipt.executionId,
      observedAt: "2026-10-27T10:00:02.000Z",
      providerResult: "success",
    },
    {
      env: {
        IZAKHONO_RECONCILIATION_JOURNAL_PATH: journalPath,
        IZAKHONO_EXECUTION_OWNER_ID: "production-test-node",
      },
    },
  );
  assert.equal(result.reconciliation.state, "completed");
  assert.equal(result.journal.decision, "completed");
  assert.equal(result.journal.ownerId, "production-test-node");
} finally {
  await rm(journalPath, { force: true });
  await rm(`${journalPath}.locks`, { recursive: true, force: true });
  await rm(root, { recursive: true, force: true });
}

console.log("production reconciliation runtime tests passed");
