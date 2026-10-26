import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileExecutionPersistenceStore } from "./file-execution-persistence";
import type { RecoveryRecord } from "./execution-recovery";

const record = (sequence: number): RecoveryRecord => ({
  schema: "izakhono.marketing.recovery-record.v1",
  sequence,
  receipt: {
    schema: "izakhono.marketing.execution-receipt.v1",
    executionId: "campaign-1:approval-1",
    campaignId: "campaign-1",
    approvalId: "approval-1",
    idempotencyKey: "campaign-1:approval-1:facebook:2026-10-26T10:00:00.000Z",
    attempt: sequence,
    result: sequence === 1 ? "retryable_failure" : "success",
    nextAction: sequence === 1 ? "retry" : "complete",
    issuedAt: "2026-10-26T10:00:00.000Z",
    adapter: "owned",
  },
});

describe("FileExecutionPersistenceStore", () => {
  it("persists records across store reconstruction", async () => {
    const directory = await mkdtemp(join(tmpdir(), "izakhono-execution-"));
    const path = join(directory, "ledger.jsonl");

    try {
      const first = new FileExecutionPersistenceStore(path);
      await first.append(record(1));
      await first.append(record(2));

      const second = new FileExecutionPersistenceStore(path);
      await expect(second.load()).resolves.toEqual([record(1), record(2)]);
      await expect(readFile(path, "utf8")).resolves.toContain("\\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects non-contiguous sequence numbers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "izakhono-execution-"));
    const path = join(directory, "ledger.jsonl");

    try {
      const store = new FileExecutionPersistenceStore(path);
      await store.append(record(1));
      await expect(store.append(record(3))).rejects.toThrow("Persistence sequence must be contiguous");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
