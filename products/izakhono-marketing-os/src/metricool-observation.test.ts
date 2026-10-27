import { strict as assert } from "node:assert";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";
import { createMetricoolObservationAdapter, HttpMetricoolObservationClient } from "./metricool-observation";

const receipt: ExecutionReceipt = {
  schema: "izakhono.marketing.execution-receipt.v1",
  executionId: "exec-metricool-1",
  campaignId: "campaign-metricool-1",
  approvalId: "approval-metricool-1",
  idempotencyKey: "campaign-metricool-1:approval-metricool-1:instagram:2026-10-27T10:00:00.000Z",
  attempt: 1,
  result: "retryable_failure",
  nextAction: "retry",
  adapter: "metricool",
  recordedAt: "2026-10-27T10:00:01.000Z",
};
const record: RecoveryRecord = { schema: "izakhono.marketing.recovery-record.v1", sequence: 1, receipt };

const client = new HttpMetricoolObservationClient({
  endpoint: "https://metricool.example/observe",
  token: "secret",
  fetchImpl: async () => new Response(JSON.stringify({
    executionId: record.receipt.executionId,
    idempotencyKey: record.receipt.idempotencyKey,
    observedAt: "2026-10-27T10:00:02.000Z",
    status: "retryable_failure",
  }), { status: 200, headers: { "content-type": "application/json" } }),
});
const observation = await createMetricoolObservationAdapter(client).observe(record);
assert.equal(observation.providerResult, "retryable_failure");

const mismatch = new HttpMetricoolObservationClient({
  endpoint: "https://metricool.example/observe",
  token: "secret",
  fetchImpl: async () => new Response(JSON.stringify({
    executionId: "wrong-execution",
    idempotencyKey: record.receipt.idempotencyKey,
    observedAt: "2026-10-27T10:00:02.000Z",
    status: "success",
  }), { status: 200 }),
});
await assert.rejects(() => createMetricoolObservationAdapter(mismatch).observe(record), /execution identity mismatch/);

const failed = new HttpMetricoolObservationClient({
  endpoint: "https://metricool.example/observe",
  token: "secret",
  fetchImpl: async () => new Response("upstream failure", { status: 503 }),
});
await assert.rejects(() => failed.observe(record), /HTTP 503/);

console.log("Metricool observation tests passed");
