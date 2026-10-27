import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProductionExecutionRuntime } from "./production-execution-runtime";
import type { AdapterExecutor } from "./execution-runtime";
import type { RetryPolicy } from "./execution-reliability";

const retryPolicy: RetryPolicy = { maxAttempts: 2 };
const executor: AdapterExecutor = {
  execute: async () => ({ result: "success" }),
};

describe("createProductionExecutionRuntime", () => {
  it("requires explicit durable ledger and lease paths", async () => {
    await expect(createProductionExecutionRuntime({ executor, retryPolicy, env: {} })).rejects.toThrow(
      "IZAKHONO_EXECUTION_LEDGER_PATH is required",
    );
  });

  it("rejects ephemeral production storage", async () => {
    await expect(
      createProductionExecutionRuntime({
        executor,
        retryPolicy,
        env: {
          IZAKHONO_EXECUTION_LEDGER_PATH: "/tmp/izakhono/ledger.jsonl",
          IZAKHONO_EXECUTION_LEASE_DIRECTORY: "/persistent/leases",
        },
      }),
    ).rejects.toThrow("cannot use an ephemeral filesystem path");
  });

  it("restores through the durable storage and lease factories", async () => {
    const directory = await mkdtemp(join(process.cwd(), "izakhono-production-runtime-"));
    try {
      const runtime = await createProductionExecutionRuntime({
        executor,
        retryPolicy,
        env: {
          IZAKHONO_EXECUTION_LEDGER_PATH: join(directory, "ledger.jsonl"),
          IZAKHONO_EXECUTION_LEASE_DIRECTORY: join(directory, "leases"),
        },
      });
      expect(runtime).toBeDefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
