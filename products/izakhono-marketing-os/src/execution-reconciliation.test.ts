import { reconcileExecution, classifyOrphanedExecution } from "./execution-reconciliation";
import type { RecoveryRecord } from "./execution-recovery";

const receipt = {
  schema: "izakhono.marketing.execution-receipt.v1" as const,
  executionId: "exec-1",
  campaignId: "campaign-1",
  approvalId: "approval-1",
  idempotencyKey: "campaign-1:approval-1:facebook:2026-10-27T09:00:00.000Z",
  attempt: 1,
  result: "retryable_failure" as const,
  nextAction: "retry" as const,
  recordedAt: "2026-10-27T09:00:01.000Z",
  adapter: "owned" as const,
};

const record: RecoveryRecord = {
  schema: "izakhono.marketing.recovery-record.v1",
  sequence: 1,
  receipt,
};

const recovered = reconcileExecution(record, {
  idempotencyKey: receipt.idempotencyKey,
  executionId: receipt.executionId,
  observedAt: "2026-10-27T09:00:05.000Z",
  providerResult: "success",
});
if (recovered.state !== "completed") throw new Error("Successful provider observation must reconcile to completed");

if (classifyOrphanedExecution(receipt, "retryable_failure") !== "retryable") {
  throw new Error("Retryable orphan must remain retryable");
}
if (classifyOrphanedExecution(receipt, "permanent_failure") !== "dead_letter") {
  throw new Error("Permanent provider failure must reconcile to dead letter");
}

let mismatchRejected = false;
try {
  reconcileExecution(record, {
    idempotencyKey: "wrong-key",
    executionId: receipt.executionId,
    observedAt: "2026-10-27T09:00:05.000Z",
    providerResult: "success",
  });
} catch {
  mismatchRejected = true;
}
if (!mismatchRejected) throw new Error("Reconciliation must reject idempotency mismatches");

console.log("IZAKHONO MARKETING OS execution reconciliation contract validated");
