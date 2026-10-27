import { strict as assert } from "node:assert";
import { createProductionProviderObservationRegistry, assertProductionProviderObservationConfiguration } from "./production-provider-observation";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";

const receipt: ExecutionReceipt = {
  schema: "izakhono.marketing.execution-receipt.v1",
  executionId: "exec-prod-1",
  campaignId: "campaign-prod-1",
  approvalId: "approval-prod-1",
  idempotencyKey: "campaign-prod-1:approval-prod-1:instagram:2026-10-27T10:00:00.000Z",
  attempt: 1,
  result: "retryable_failure",
  nextAction: "retry",
  adapter: "owned",
  recordedAt: "2026-10-27T10:00:01.000Z",
};
const record: RecoveryRecord = { schema: "izakhono.marketing.recovery-record.v1", sequence: 1, receipt };
const env = {
  IZAKHONO_OWNED_NODE_OBSERVATION_ENDPOINT: "https://owned.example/observe",
  IZAKHONO_OWNED_NODE_OBSERVATION_TOKEN: "configured-token",
  METRICOOL_OBSERVATION_ENDPOINT: "https://metricool.example/observe",
  METRICOOL_OBSERVATION_TOKEN: "configured-token",
};

assertProductionProviderObservationConfiguration(env);
let calls = 0;
const registry = createProductionProviderObservationRegistry(env, async (_input, init) => {
  calls += 1;
  const body = JSON.parse(String(init?.body));
  return new Response(JSON.stringify({ executionId: body.executionId, idempotencyKey: body.idempotencyKey, observedAt: "2026-10-27T10:00:02.000Z", status: "success" }), { status: 200 });
});
const observation = await registry.observe(record);
assert.equal(observation.providerResult, "success");
assert.equal(calls, 1);
await assert.rejects(() => createProductionProviderObservationRegistry({ ...env, METRICOOL_OBSERVATION_TOKEN: "" }), /METRICOOL_OBSERVATION_TOKEN is required/);

console.log("production provider observation tests passed");
