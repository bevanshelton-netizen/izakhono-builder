import assert from "node:assert/strict";
import { createExecutionReceipt } from "./execution-reliability";
import { InMemoryExecutionStore } from "./execution-store";

const receipt = createExecutionReceipt(
  "exec-store-1",
  "campaign-store-1",
  "approval-store-1",
  "campaign-store-1:approval-store-1:facebook:2026-10-26T12:00:00Z",
  1,
  "retryable_failure",
  "2026-10-26T12:01:00Z",
  "metricool",
  { maxAttempts: 3 },
);

const store = new InMemoryExecutionStore();
const first = store.append(receipt, 0);
assert.equal(first.version, 1);
assert.equal(first.records[0]?.sequence, 1);
assert.equal(store.load().records[0]?.receipt.executionId, "exec-store-1");

assert.throws(() => store.append(receipt, 1), /already exists/);
assert.throws(() => store.append({ ...receipt, executionId: "exec-store-2", idempotencyKey: "new-key" }, 0), /version conflict/);

const restored = new InMemoryExecutionStore(store.load());
const secondReceipt = { ...receipt, executionId: "exec-store-2", idempotencyKey: "campaign-store-1:approval-store-1:instagram:2026-10-26T12:00:00Z" };
const second = restored.append(secondReceipt, 1);
assert.equal(second.version, 2);
assert.deepEqual(second.records.map((record) => record.sequence), [1, 2]);

console.log("IZAKHONO MARKETING OS execution store contract validated");
