import { createExecutionReceipt } from "./execution-reliability";
import { LedgerPersistenceAdapter, MemoryExecutionPersistenceStore } from "./execution-persistence";

const receipt = createExecutionReceipt(
  "execution-persistence-001",
  "campaign-persistence-001",
  "approval-persistence-001",
  "campaign-persistence-001:approval-persistence-001:facebook:2026-10-27T09:00:00+02:00",
  1,
  "success",
  "2026-10-27T08:00:00+02:00",
  "owned",
  { maxAttempts: 3 },
);

const record = {
  schema: "izakhono.marketing.recovery-record.v1" as const,
  sequence: 1,
  receipt,
};

const store = new MemoryExecutionPersistenceStore();
const adapter = new LedgerPersistenceAdapter(store);
await adapter.saveSnapshot([record]);

const restored = await adapter.restore();
if (restored.length !== 1) throw new Error("Persistence adapter must restore stored records");
if (restored[0].sequence !== 1) throw new Error("Persistence adapter must preserve record sequence");
if (restored[0].receipt.idempotencyKey !== receipt.idempotencyKey) throw new Error("Persistence adapter must preserve idempotency identity");

let sequenceBlocked = false;
try {
  await store.append(record);
} catch {
  sequenceBlocked = true;
}
if (!sequenceBlocked) throw new Error("Persistence store must reject duplicate sequence records");

console.log("IZAKHONO MARKETING OS persistence boundary validated");
