import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProductionExecutionPersistenceStore, FileExecutionPersistenceStore } from "./file-execution-persistence";
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
    recordedAt: "2026-10-26T10:00:00.000Z",
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
      await expect(readFile(path, "utf8")).resolves.toContain("\n");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes concurrent appends within one process", async () => {
    const directory = await mkdtemp(join(tmpdir(), "izakhono-execution-"));
    const path = join(directory, "ledger.jsonl");

    try {
      const store = new FileExecutionPersistenceStore(path);
      await Promise.all([store.append(record(1)), store.append(record(2)), store.append(record(3))]);
      await expect(store.load()).resolves.toEqual([record(1), record(2), record(3)]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes concurrent appends across independent store instances", async () => {
    const directory = await mkdtemp(join(tmpdir(), "izakhono-execution-"));
    const path = join(directory, "ledger.jsonl");

    try {
      const first = new FileExecutionPersistenceStore(path, { ownerId: "node-a" });
      const second = new FileExecutionPersistenceStore(path, { ownerId: "node-b" });
      const third = new FileExecutionPersistenceStore(path, { ownerId: "node-c" });

      await Promise.all([
        first.append(record(1)),
        second.append(record(2)),
        third.append(record(3)),
      ]);

      const persisted = await first.load();
      expect(persisted).toHaveLength(3);
      expect(persisted.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
      expect(persisted.map((entry) => entry.receipt.attempt)).toEqual([1, 2, 3]);
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

  it("fails closed on a malformed or blank ledger record", async () => {
    const directory = await mkdtemp(join(tmpdir(), "izakhono-execution-"));
    const path = join(directory, "ledger.jsonl");

    try {
      await writeFile(path, `${JSON.stringify(record(1))}\n\n`, "utf8");
      const store = new FileExecutionPersistenceStore(path);
      await expect(store.load()).rejects.toThrow("unexpected blank record line");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when a persisted receipt is structurally invalid", async () => {
    const directory = await mkdtemp(join(tmpdir(), "izakhono-execution-"));
    const path = join(directory, "ledger.jsonl");

    try {
      const invalid = { ...record(1), receipt: { ...record(1).receipt, nextAction: "complete" } };
      await writeFile(path, `${JSON.stringify(invalid)}\n`, "utf8");
      const store = new FileExecutionPersistenceStore(path);
      await expect(store.load()).rejects.toThrow("Successful execution must complete");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("requires explicit production storage configuration", () => {
    expect(() => createProductionExecutionPersistenceStore({})).toThrow("IZAKHONO_EXECUTION_LEDGER_PATH is required");
    expect(() => createProductionExecutionPersistenceStore({ IZAKHONO_EXECUTION_LEDGER_PATH: "ledger.jsonl" })).toThrow("absolute");
  });

  it("rejects known ephemeral production storage locations", () => {
    expect(() => createProductionExecutionPersistenceStore({ IZAKHONO_EXECUTION_LEDGER_PATH: "/tmp/izakhono-ledger.jsonl" })).toThrow("ephemeral");
    expect(() => createProductionExecutionPersistenceStore({ IZAKHONO_EXECUTION_LEDGER_PATH: "/var/task/izakhono-ledger.jsonl" })).toThrow("ephemeral");
    expect(() => createProductionExecutionStoreForTest()).not.toThrow();
  });
});

function createProductionExecutionStoreForTest(): ReturnType<typeof createProductionExecutionPersistenceStore> {
  return createProductionExecutionPersistenceStore({
    IZAKHONO_EXECUTION_LEDGER_PATH: "/mnt/izakhono/marketing-os/execution-ledger.jsonl",
  });
}
