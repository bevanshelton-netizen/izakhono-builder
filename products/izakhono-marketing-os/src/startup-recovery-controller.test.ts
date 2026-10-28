import { strict as assert } from "node:assert";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";
import { MemoryExecutionPersistenceStore } from "./execution-persistence";
import { MemoryExecutionLeaseStore } from "./execution-lease";
import { MemoryReconciliationJournalStore } from "./execution-reconciliation-journal";
import { StartupRecoveryController } from "./startup-recovery-controller";

const receipt: ExecutionReceipt = {
  schema: "izakhono.marketing.execution-receipt.v1",
  executionId: "exec-startup-1",
  campaignId: "campaign-startup-1",
  approvalId: "approval-startup-1",
  idempotencyKey: "campaign-startup-1:approval-startup-1:instagram:2026-10-27T10:00:00.000Z",
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

const persistence = new MemoryExecutionPersistenceStore();
await persistence.append(record);
const journal = new MemoryReconciliationJournalStore();
const leases = new MemoryExecutionLeaseStore();
let observations = 0;

const controller = new StartupRecoveryController({
  persistence,
  journal,
  leases,
  ownerId: "startup-node-1",
  now: () => "2026-10-27T10:00:02.000Z",
  observer: {
    async observe(candidate) {
      observations += 1;
      return {
        idempotencyKey: candidate.receipt.idempotencyKey,
        executionId: candidate.receipt.executionId,
        observedAt: "2026-10-27T10:00:02.000Z",
        providerResult: "success",
      };
    },
  },
});

const first = await controller.run();
assert.equal(first.acquired, true);
assert.equal(first.scanned, 1);
assert.equal(first.candidates, 1);
assert.equal(first.reconciled, 1);
assert.equal(first.journalEntries.length, 1);
assert.equal(observations, 1);

const afterRecovery = await persistence.load();
assert.equal(afterRecovery.length, 2);
assert.equal(afterRecovery[1].sequence, 2);
assert.equal(afterRecovery[1].receipt.idempotencyKey, receipt.idempotencyKey);
assert.equal(afterRecovery[1].receipt.result, "success");
assert.equal(afterRecovery[1].receipt.nextAction, "complete");
assert.equal(afterRecovery[1].receipt.attempt, 1);

const second = await controller.run();
assert.equal(second.acquired, true);
assert.equal(second.candidates, 0);
assert.equal(second.skippedTerminal, 1);
assert.equal(second.skippedPreviouslyCompleted, 0);
assert.equal(second.journalEntries.length, 0);
assert.equal(observations, 1);

const repairedPersistence = new MemoryExecutionPersistenceStore();
const repairedReceipt: ExecutionReceipt = {
  ...receipt,
  executionId: "exec-startup-repair",
  result: "success",
  nextAction: "complete",
  recordedAt: "2026-10-27T10:00:04.000Z",
};
await repairedPersistence.append({ ...record, receipt: repairedReceipt });
const repairedJournal = new MemoryReconciliationJournalStore();
const repairedLeases = new MemoryExecutionLeaseStore();
let repairedObservations = 0;
const repairController = new StartupRecoveryController({
  persistence: repairedPersistence,
  journal: repairedJournal,
  leases: repairedLeases,
  ownerId: "startup-node-repair",
  now: () => "2026-10-27T10:00:05.000Z",
  observer: {
    async observe() {
      repairedObservations += 1;
      throw new Error("terminal ledger must not trigger provider observation");
    },
  },
});
const repaired = await repairController.run();
assert.equal(repaired.acquired, true);
assert.equal(repaired.scanned, 1);
assert.equal(repaired.candidates, 0);
assert.equal(repaired.skippedTerminal, 1);
assert.equal(repaired.failed, 0);
assert.equal(repaired.journalEntries.length, 1);
assert.equal(repaired.journalEntries[0].executionId, repairedReceipt.executionId);
assert.equal(repaired.journalEntries[0].decision, "completed");
assert.equal(repaired.journalEntries[0].observed, "provider_success");
assert.equal(repairedObservations, 0);

const repairedAgain = await repairController.run();
assert.equal(repairedAgain.skippedTerminal, 1);
assert.equal(repairedAgain.journalEntries.length, 0);
const repairedHistory = await repairedJournal.load();
assert.equal(repairedHistory.length, 1);

const concurrentPersistence = new MemoryExecutionPersistenceStore();
await concurrentPersistence.append({ ...record, receipt: { ...receipt, executionId: "exec-startup-concurrent" } });
const concurrentJournal = new MemoryReconciliationJournalStore();
const concurrentLeases = new MemoryExecutionLeaseStore();
let releaseObservation!: () => void;
let enteredObservation!: () => void;
const entered = new Promise<void>((resolve) => { enteredObservation = resolve; });
const release = new Promise<void>((resolve) => { releaseObservation = resolve; });

const observer = {
  async observe(candidate: RecoveryRecord) {
    enteredObservation();
    await release;
    return {
      idempotencyKey: candidate.receipt.idempotencyKey,
      executionId: candidate.receipt.executionId,
      observedAt: "2026-10-27T10:00:03.000Z",
      providerResult: "success" as const,
    };
  },
};

const firstConcurrent = new StartupRecoveryController({
  persistence: concurrentPersistence,
  journal: concurrentJournal,
  ownerId: "startup-node-a",
  leases: concurrentLeases,
  observer,
});
const secondConcurrent = new StartupRecoveryController({
  persistence: concurrentPersistence,
  journal: concurrentJournal,
  ownerId: "startup-node-b",
  observer,
});

const running = firstConcurrent.run();
await entered;
const blocked = await secondConcurrent.run();
assert.equal(blocked.acquired, false);
assert.equal(blocked.candidates, 0);
releaseObservation();
const completed = await running;
assert.equal(completed.acquired, true);
assert.equal(completed.reconciled, 1);

console.log("startup recovery controller tests passed");
