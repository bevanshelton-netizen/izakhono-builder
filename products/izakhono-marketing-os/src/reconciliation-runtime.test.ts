import { strict as assert } from "node:assert";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";
import { MemoryReconciliationJournalStore } from "./execution-reconciliation-journal";
import { ReconciliationRuntime } from "./reconciliation-runtime";

const receipt: ExecutionReceipt = {
  schema: "izakhono.marketing.execution-receipt.v1",
  executionId: "exec-1",
  campaignId: "campaign-1",
  approvalId: "approval-1",
  idempotencyKey: "campaign-1:approval-1:instagram:2026-10-27T10:00:00.000Z",
  attempt: 1,
  result: "retryable_failure",
  nextAction: "retry",
  adapter: "owned",
  recordedAt: "2026-10-27T10:00:01.000Z",
};

const record: RecoveryRecord = {
  schema: "izakhono.marketing.recovery-record.v1",
  sequence: 1,
  receipt,
};

const store = new MemoryReconciliationJournalStore();
const runtime = new ReconciliationRuntime(store);
const result = await runtime.reconcile(record, {
  idempotencyKey: receipt.idempotencyKey,
  executionId: receipt.executionId,
  observedAt: "2026-10-27T10:00:02.000Z",
  providerResult: "success",
});

assert.equal(result.reconciliation.state, "completed");
assert.equal(result.journal.decision, "completed");
assert.equal(result.journal.observed, "provider_success");
assert.equal(result.journal.sequence, 1);
assert.deepEqual(await store.load(), [result.journal]);

console.log("reconciliation runtime tests passed");
