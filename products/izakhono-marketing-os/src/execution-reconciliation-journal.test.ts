import { ReconciliationJournal, MemoryReconciliationJournalStore } from "./execution-reconciliation-journal";

const store = new MemoryReconciliationJournalStore();
const journal = new ReconciliationJournal(store);

await journal.record({
  executionId: "exec-1",
  idempotencyKey: "campaign:approval:facebook:2026-10-27T10:00:00Z",
  adapter: "owned",
  observed: "provider_success",
  decision: "completed",
  observedAt: "2026-10-27T10:01:00Z",
  reconciledAt: "2026-10-27T10:01:01Z",
  ownerId: "node-a",
});

await journal.record({
  executionId: "exec-1",
  idempotencyKey: "campaign:approval:facebook:2026-10-27T10:00:00Z",
  adapter: "owned",
  observed: "provider_unknown",
  decision: "unknown_external_state",
  observedAt: "2026-10-27T10:02:00Z",
  reconciledAt: "2026-10-27T10:02:01Z",
  ownerId: "node-b",
  note: "Provider did not expose a verifiable idempotency lookup.",
});

const history = await journal.history("campaign:approval:facebook:2026-10-27T10:00:00Z");
if (history.length !== 2) throw new Error("Expected two reconciliation observations");
if (history[0].sequence !== 1 || history[1].sequence !== 2) throw new Error("Journal sequence is not contiguous");

const latest = await journal.latest("campaign:approval:facebook:2026-10-27T10:00:00Z");
if (latest?.decision !== "unknown_external_state") throw new Error("Latest reconciliation decision was not preserved");

try {
  await store.append({
    schema: "izakhono.marketing.reconciliation-journal.v1",
    sequence: 4,
    executionId: "exec-2",
    idempotencyKey: "bad-sequence",
    adapter: "owned",
    observed: "provider_success",
    decision: "completed",
    observedAt: "2026-10-27T10:03:00Z",
    reconciledAt: "2026-10-27T10:03:01Z",
    ownerId: "node-a",
  });
  throw new Error("Expected sequence validation failure");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("contiguous")) throw error;
}
