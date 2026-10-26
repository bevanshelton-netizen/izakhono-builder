import {
  canRetry,
  createExecutionReceipt,
  createIdempotencyKey,
  ExecutionLedger,
  validateExecutionReceipt,
} from "./execution-reliability";

const key = createIdempotencyKey(
  "campaign-001",
  "approval-001",
  "facebook",
  "2026-10-27T09:00:00+02:00",
);

if (key !== "campaign-001:approval-001:facebook:2026-10-27T09:00:00+02:00") {
  throw new Error("Idempotency key must be deterministic");
}

const sameKey = createIdempotencyKey(
  "campaign-001",
  "approval-001",
  "facebook",
  "2026-10-27T09:00:00+02:00",
);
if (sameKey !== key) throw new Error("Equivalent execution identity must produce the same key");

const ledger = new ExecutionLedger();
ledger.register(key);
if (!ledger.has(key)) throw new Error("Registered execution must be detectable");

let duplicateBlocked = false;
try {
  ledger.register(key);
} catch {
  duplicateBlocked = true;
}
if (!duplicateBlocked) throw new Error("Duplicate execution must be blocked");

if (!canRetry(1, "retryable_failure", { maxAttempts: 3 })) throw new Error("Retryable attempt should retry");
if (!canRetry(2, "retryable_failure", { maxAttempts: 3 })) throw new Error("Second retryable attempt should retry");
if (canRetry(3, "retryable_failure", { maxAttempts: 3 })) throw new Error("Maximum attempts must stop retries");
if (canRetry(1, "success", { maxAttempts: 3 })) throw new Error("Successful execution must not retry");
if (canRetry(1, "permanent_failure", { maxAttempts: 3 })) throw new Error("Permanent failure must not retry");

const retryReceipt = createExecutionReceipt(
  "execution-001",
  "campaign-001",
  "approval-001",
  key,
  1,
  "retryable_failure",
  "2026-10-27T09:01:00+02:00",
  "metricool",
  { maxAttempts: 3 },
);
validateExecutionReceipt(retryReceipt);
if (retryReceipt.nextAction !== "retry") throw new Error("Retryable failure must request retry");

const successReceipt = createExecutionReceipt(
  "execution-001",
  "campaign-001",
  "approval-001",
  key,
  2,
  "success",
  "2026-10-27T09:02:00+02:00",
  "metricool",
  { maxAttempts: 3 },
);
validateExecutionReceipt(successReceipt);
if (successReceipt.nextAction !== "complete") throw new Error("Success must complete");

const deadLetterReceipt = createExecutionReceipt(
  "execution-001",
  "campaign-001",
  "approval-001",
  key,
  3,
  "retryable_failure",
  "2026-10-27T09:03:00+02:00",
  "metricool",
  { maxAttempts: 3 },
);
validateExecutionReceipt(deadLetterReceipt);
if (deadLetterReceipt.nextAction !== "dead_letter") throw new Error("Exhausted retries must dead-letter");

console.log("IZAKHONO MARKETING OS execution reliability contract validated");
