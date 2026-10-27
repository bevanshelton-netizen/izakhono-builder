import { strict as assert } from "node:assert";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";
import { createOwnedNodeObservationAdapter, HttpOwnedNodeObservationClient } from "./owned-node-observation";

const receipt: ExecutionReceipt = {
  schema: "izakhono.marketing.execution-receipt.v1",
  executionId: "exec-owned-1",
  campaignId: "campaign-owned-1",
  approvalId: "approval-owned-1",
  idempotencyKey: "campaign-owned-1:approval-owned-1:instagram:2026-10-27T10:00:00.000Z",
  attempt: 1,
  result: "retryable_failure",
  nextAction: "retry",
  adapter: "owned",
  recordedAt: "2026-10-27T10:00:01.000Z",
};
const record: RecoveryRecord = { schema: "izakhono.marketing.recovery-record.v1", sequence: 1, receipt };

let requestBody = "";
const client = new HttpOwnedNodeObservationClient({
  endpoint: "http://owned-node.internal/observe",
  token: "secret",
  fetchImpl: async (_input, init) => {
    requestBody = String(init?.body);
    return new Response(JSON.stringify({
      executionId: record.receipt.executionId,
      idempotencyKey: record.receipt.idempotencyKey,
      observedAt: "2026-10-27T10:00:02.000Z",
      status: "success",
    }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
const observation = await createOwnedNodeObservationAdapter(client).observe(record);
assert.equal(observation.providerResult, "success");
assert.match(requestBody, /exec-owned-1/);

await assert.rejects(
  () => new HttpOwnedNodeObservationClient({ endpoint: "file:///tmp/observe", token: "secret" }),
  /must use HTTP or HTTPS/,
);

const malformed = new HttpOwnedNodeObservationClient({
  endpoint: "http://owned-node.internal/observe",
  token: "secret",
  fetchImpl: async () => new Response(JSON.stringify({ status: "success" }), { status: 200 }),
});
await assert.rejects(() => malformed.observe(record), /executionId is required/);

console.log("owned-node observation tests passed");
