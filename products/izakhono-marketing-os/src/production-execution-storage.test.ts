import { describe, expect, it } from "vitest";
import {
  createProductionExecutionStorage,
  createProductionExecutionStorageFromEnv,
} from "./production-execution-storage";

describe("production execution storage", () => {
  it("requires an absolute non-ephemeral ledger path", () => {
    expect(() => createProductionExecutionStorage({ ledgerPath: "ledger.jsonl" })).toThrow("absolute");
    expect(() => createProductionExecutionStorage({ ledgerPath: "/tmp/ledger.jsonl" })).toThrow("ephemeral");
    expect(() => createProductionExecutionStorage({ ledgerPath: "/var/task/ledger.jsonl" })).toThrow("ephemeral");
  });

  it("creates the owned file persistence adapter for a persistent mount", async () => {
    const store = createProductionExecutionStorage({ ledgerPath: "/mnt/izakhono/marketing-os/ledger.jsonl" });
    await expect(store.load()).resolves.toEqual([]);
  });

  it("fails closed when production storage is not configured", () => {
    expect(() => createProductionExecutionStorageFromEnv({})).toThrow("IZAKHONO_EXECUTION_LEDGER_PATH");
  });
});
