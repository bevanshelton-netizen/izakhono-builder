import { strict as assert } from "node:assert";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";
import { MemoryExecutionPersistenceStore } from "./execution-persistence";
import { MemoryExecutionLeaseStore } from "./execution-lease";
import { MemoryReconciliationJournalStore } from "./execution-reconciliation-journal";
import { createFinalizationId, MemoryFinalizationStore } from "./execution-finalization";
import { StartupRecoveryController } from "./startup-recovery-controller";

const sourceReceipt: ExecutionReceipt = {
  schema: "izakhono.marketing.execution-receipt.v1",
  executionId: "exec-finalization-replay",
  campaignId: "campaign-finalization",
  approvalId: "approval-finalization",
  idempotencyKey: "campaign-finalization:approval-finalization:instagram:2026-10-28T05:00:00.000Z",
  attempt: 1,
  result: "retryable_failure",
  nextAction: "retry",
  adapter: "owned",
  recordedAt: "2026-10-28T05:00:01.000Z",
};
const targetReceipt: ExecutionReceipt = { ...sourceReceipt, result: "success", nextAction: "complete", recordedAt: "2026-10-28T05:00:02.000Z" };
const source: RecoveryRecord = { schema: "izakhono.marketing.recovery-record.v1", sequence: 1, receipt: sourceReceipt };
const target: RecoveryRecord = { schema: "izakhono.marketing.recovery-record.v1", sequence: 2, receipt: targetReceipt };
const finalization = {
  schema: "izakhono.marketing.recovery-finalization.v1" as const,
  finalizationId: createFinalizationId(source, target),
  status: "prepared" as const,
  source,
  target,
  journal: {
    schema: "izakhono.marketing.reconciliation-journal.v1" as const,
    executionId: targetReceipt.executionId,
    idempotencyKey: targetReceipt.idempotencyKey,
    adapter: "owned" as const,
    observed: "provider_success" as const,
    decision: "completed" as const,
    observedAt: targetReceipt.recordedAt,
    reconciledAt: "2026-10-28T05:00:03.000Z",
    ownerId: "finalization-test-node",
  },
  preparedAt: "2026-10-28T05:00:03.000Z",
};

const persistence = new MemoryExecutionPersistenceStore();
await persistence.append(source);
const journal = new MemoryReconciliationJournalStore();
const leases = new MemoryExecutionLeaseStore();
const finalizations = new MemoryFinalizationStore();
await finalizations.prepare(finalization);
let providerObservations = 0;

const controller = new StartupRecoveryController({
  persistence,
  journal,
  leases,
  finalizations,
  ownerId: "startup-finalization-test",
  now: () => "2026-10-28T05:00:04.000Z",
  observer: {
    async observe() {
      providerObservations += 1;
      throw new Error("prepared finalization replay must not invoke provider observation");
    },
  },
});

const first = await controller.run();
assert.equal(first.acquired, true);
assert.equal(first.finalizationsReplayed, 1);
assert.equal(first.failed, 0);
assert.equal(providerObservations, 0);
assert.deepEqual(await persistence.load(), [source, target]);
assert.equal((await journal.load()).length, 1);
assert.equal((await journal.load())[0].decision, "completed");
assert.equal((await finalizations.load())[0].status, "committed");

const second = await controller.run();
assert.equal(second.finalizationsReplayed, 0);
assert.equal(providerObservations, 0);
assert.equal((await persistence.load()).length, 2);
assert.equal((await journal.load()).length, 1);

console.log("startup finalization replay tests passed");
