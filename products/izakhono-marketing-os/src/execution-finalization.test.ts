import { strict as assert } from "node:assert";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";
import { createFinalizationId, MemoryFinalizationStore, validateFinalization } from "./execution-finalization";

const sourceReceipt: ExecutionReceipt = { schema: "izakhono.marketing.execution-receipt.v1", executionId: "exec-source", campaignId: "campaign-1", approvalId: "approval-1", idempotencyKey: "campaign-1:approval-1:instagram:2026-10-27T10:00:00.000Z", attempt: 1, result: "retryable_failure", nextAction: "retry", adapter: "owned", recordedAt: "2026-10-27T10:00:01.000Z" };
const targetReceipt: ExecutionReceipt = { ...sourceReceipt, result: "success", nextAction: "complete", recordedAt: "2026-10-27T10:00:02.000Z" };
const source: RecoveryRecord = { schema: "izakhono.marketing.recovery-record.v1", sequence: 1, receipt: sourceReceipt };
const target: RecoveryRecord = { schema: "izakhono.marketing.recovery-record.v1", sequence: 2, receipt: targetReceipt };
const finalization = {
  schema: "izakhono.marketing.recovery-finalization.v1" as const,
  finalizationId: createFinalizationId(source, target),
  status: "prepared" as const,
  source,
  target,
  journal: { schema: "izakhono.marketing.reconciliation-journal.v1" as const, executionId: targetReceipt.executionId, idempotencyKey: targetReceipt.idempotencyKey, adapter: "owned" as const, observed: "provider_success" as const, decision: "completed" as const, observedAt: targetReceipt.recordedAt, reconciledAt: "2026-10-27T10:00:03.000Z", ownerId: "test-node" },
  preparedAt: "2026-10-27T10:00:03.000Z",
};

validateFinalization(finalization);
const store = new MemoryFinalizationStore();
await store.prepare(finalization);
assert.equal((await store.load())[0].status, "prepared");
await store.commit(finalization.finalizationId, "2026-10-27T10:00:04.000Z");
const committed = (await store.load())[0];
assert.equal(committed.status, "committed");
assert.equal(committed.committedAt, "2026-10-27T10:00:04.000Z");
await store.commit(finalization.finalizationId, "2026-10-27T10:00:05.000Z");
assert.equal((await store.load())[0].committedAt, "2026-10-27T10:00:04.000Z");

assert.throws(() => validateFinalization({ ...finalization, source: { ...source, receipt: { ...sourceReceipt, idempotencyKey: "wrong" } } }), /idempotency key mismatch/);
assert.throws(() => validateFinalization({ ...finalization, target: { ...target, sequence: 9 } }), /target sequence/);

console.log("execution finalization tests passed");
