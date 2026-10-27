import { describe, expect, it } from "vitest";
import type { RecoveryRecord } from "./execution-recovery";
import { createMetricoolObservationAdapter, createOwnedNodeObservationAdapter } from "./provider-observation-adapters";

const record: RecoveryRecord = {
  schema: "izakhono.marketing.recovery-record.v1",
  sequence: 1,
  receipt: {
    schema: "izakhono.marketing.execution-receipt.v1",
    campaignId: "campaign-1",
    approvalId: "approval-1",
    executionId: "execution-1",
    idempotencyKey: "campaign-1:approval-1:facebook:2026-10-27T10:00:00.000Z",
    adapter: "owned",
    attempt: 1,
    result: "retryable_failure",
    nextAction: "retry",
    recordedAt: "2026-10-27T10:00:01.000Z",
  },
};

describe("provider observation adapters", () => {
  it("queries the owned-node client and normalizes its observation", async () => {
    let queried = false;
    const adapter = createOwnedNodeObservationAdapter({
      async observeExecution(input) {
        queried = true;
        expect(input.receipt.executionId).toBe("execution-1");
        return {
          executionId: "execution-1",
          idempotencyKey: input.receipt.idempotencyKey,
          status: "success",
          observedAt: "2026-10-27T10:01:00.000Z",
        };
      },
    });

    await expect(adapter.observe(record)).resolves.toMatchObject({
      executionId: "execution-1",
      providerResult: "success",
    });
    expect(queried).toBe(true);
  });

  it("queries the Metricool client and normalizes a retryable result", async () => {
    const metricoolRecord: RecoveryRecord = {
      ...record,
      receipt: { ...record.receipt, adapter: "metricool" },
    };
    const adapter = createMetricoolObservationAdapter({
      async observeExecution(input) {
        return {
          executionId: input.receipt.executionId,
          idempotencyKey: input.receipt.idempotencyKey,
          status: "retryable_failure",
        };
      },
    });

    await expect(adapter.observe(metricoolRecord)).resolves.toMatchObject({
      providerResult: "retryable_failure",
    });
  });

  it("fails closed when the provider credentials/configuration are unavailable", async () => {
    const adapter = createOwnedNodeObservationAdapter(
      { async observeExecution() { throw new Error("must not query"); } },
      false,
    );

    await expect(adapter.observe(record)).rejects.toThrow("owned provider observation credentials are not configured");
  });

  it("rejects an observation for a different execution identity", async () => {
    const adapter = createOwnedNodeObservationAdapter({
      async observeExecution(input) {
        return {
          executionId: "wrong-execution",
          idempotencyKey: input.receipt.idempotencyKey,
          status: "success",
        };
      },
    });

    await expect(adapter.observe(record)).rejects.toThrow("Provider observation execution identity mismatch");
  });

  it("rejects an observation for a different idempotency key", async () => {
    const adapter = createOwnedNodeObservationAdapter({
      async observeExecution(input) {
        return {
          executionId: input.receipt.executionId,
          idempotencyKey: "wrong-key",
          status: "success",
        };
      },
    });

    await expect(adapter.observe(record)).rejects.toThrow("Provider observation idempotency key mismatch");
  });
});
