import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileReconciliationJournalStore } from "./file-reconciliation-journal";
import { ReconciliationJournal } from "./execution-reconciliation-journal";

const entry = {
  executionId: "exec-1",
  idempotencyKey: "campaign:approval:instagram:time",
  adapter: "owned" as const,
  observed: "provider_success" as const,
  decision: "completed" as const,
  observedAt: "2026-10-27T10:00:00.000Z",
  reconciledAt: "2026-10-27T10:00:01.000Z",
  ownerId: "node-1",
};

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "izakhono-reconciliation-"));
  try {
    const ephemeralPath = join(root, "journal.ndjson");
    assert.throws(() => new FileReconciliationJournalStore(ephemeralPath), /ephemeral/i);

    const persistentPath = join(process.cwd(), `.izakhono-reconciliation-${Date.now()}.ndjson`);
    try {
      const persistent = new FileReconciliationJournalStore(persistentPath);
      const journal = new ReconciliationJournal(persistent);
      const recorded = await journal.record(entry);
      assert.equal(recorded.sequence, 1);
      assert.match(await readFile(persistentPath, "utf8"), /exec-1/);
      await assert.rejects(() => persistent.append({ ...recorded, sequence: 3 }), /contiguous/);

      const first = new ReconciliationJournal(new FileReconciliationJournalStore(persistentPath));
      const second = new ReconciliationJournal(new FileReconciliationJournalStore(persistentPath));
      const [one, two] = await Promise.all([
        first.record({ ...entry, executionId: "exec-2", idempotencyKey: "key-2", ownerId: "node-2" }),
        second.record({ ...entry, executionId: "exec-3", idempotencyKey: "key-3", ownerId: "node-3" }),
      ]);
      assert.deepEqual([one.sequence, two.sequence].sort((a, b) => a - b), [2, 3]);
      assert.deepEqual((await persistent.load()).map((record) => record.sequence), [1, 2, 3]);
    } finally {
      await rm(persistentPath, { force: true });
      await rm(`${persistentPath}.locks`, { recursive: true, force: true });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main().then(() => {
  console.log("file reconciliation journal tests passed");
});
