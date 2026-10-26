import { createExecutionReceipt } from "./execution-reliability";
import { PersistentExecutionLedger } from "./execution-recovery";

const policy = { maxAttempts: 3 };
const retryReceipt = createExecutionReceipt(
  "execution-recovery-001",
  "campaign-recovery-001",
  "approval-recovery-001",
  "campaign-recovery-001:approval-recovery-001:facebook:2026-10-27T09:00:00+02:00",
  1,
  "retryable_failure",
  "2026-10-27T08:10:00+02:00",
  "metricool",
  policy,
);

const ledger = new PersistentExecutionLedger();
const record = ledger.append(retryReceipt);
if (record.sequence !== 1) throw new Error("First recovery record must have sequence 1");
if (ledger.recoveryAction(retryReceipt.idempotencyKey) !== "replay") throw new Error("Retryable receipt must be replayable");

const replay = ledger.buildReplay(retryReceipt.idempotencyKey);
if (replay.attempt !== 2) throw new Error("Replay must advance the attempt");
if (replay.idempotencyKey !== retryReceipt.idempotencyKey) throw new Error("Replay must preserve idempotency identity");

const restored = new PersistentExecutionLedger(ledger.snapshot());
if (restored.latest(retryReceipt.idempotencyKey)?.sequence !== 1) throw new Error("Ledger must restore from its snapshot");

let duplicateBlocked = false;
try {
  restored.append(retryReceipt);
} catch {
  duplicateBlocked = true;
}
if (!duplicateBlocked) throw new Error("Persistent ledger must reject duplicate idempotency keys");

const completeReceipt = createExecutionReceipt(
  "execution-recovery-002",
  "campaign-recovery-002",
  "approval-recovery-002",
  "campaign-recovery-002:approval-recovery-002:instagram:2026-10-27T10:00:00+02:00",
  1,
  "success",
  "2026-10-27T08:11:00+02:00",
  "owned",
  policy,
);
restored.append(completeReceipt);
if (restored.recoveryAction(completeReceipt.idempotencyKey) !== "complete") throw new Error("Successful execution must be complete");

const deadReceipt = createExecutionReceipt(
  "execution-recovery-003",
  "campaign-recovery-003",
  "approval-recovery-003",
  "campaign-recovery-003:approval-recovery-003:linkedin:2026-10-27T11:00:00+02:00",
  3,
  "retryable_failure",
  "2026-10-27T08:12:00+02:00",
  "owned",
  policy,
);
restored.append(deadReceipt);
if (restored.recoveryAction(deadReceipt.idempotencyKey) !== "dead_letter") throw new Error("Exhausted execution must remain dead-lettered");

console.log("IZAKHONO MARKETING OS execution recovery contract validated");
