import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileReconciliationJournalStore } from "./file-reconciliation-journal";

const entry = {
  schema: "izakhono.marketing.reconciliation-journal.v1" as const,
  sequence: 1,
  executionId: "exec-1",
  idempotencyKey: "campaign:approval:instagram:time",
  adapter: "owned" as const,
  observed: "provider_success" as const,
  decision: "completed" as const,
  observedAt: "2026-10-27T10:00:00.000Z",
  reconciledAt: "2026-10-27T10:00:01.000Z",
  ownerId: "node-1",
};

const root = await mkdtemp(join(tmpdir(), "izakhono-reconciliation-"));
const path = join(root, "journal.ndjson");
try {
  const store = new FileReconciliationJournalStore(path.replace(root, "/persistent"));
  assert.throws(() => store.load(), /persistent|ephemeral/i);

  const persistentPath = join(process.cwd(), `.izakhono-reconciliation-${Date.now()}.ndjson`);
  const persistent = new FileReconciliationJournalStore(persistentPath);
  await persistent.append(entry);
  assert.deepEqual(await persistent.load(), [entry]);
  assert.match(await readFile(persistentPath, "utf8"), /exec-1/);
  await assert.rejects(() => persistent.append({ ...entry, sequence: 3 }), /contiguous/);
  await rm(persistentPath, { force: true });
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("file reconciliation journal tests passed");
