import { strict as assert } from "node:assert";
import type { ExecutionReceipt } from "./execution-reliability";
import type { RecoveryRecord } from "./execution-recovery";
import { CredentialGatedProviderObservationAdapter, ProviderObservationRegistry } from "./provider-observation";

const receipt: ExecutionReceipt = {
  schema: "izakhono.marketing.execution-receipt.v1",
  executionId: "exec-observation-1",
  campaignId: "campaign-observation-1",
  approvalId: "approval-observation-1",
  idempotencyKey: "campaign-observation-1:approval-observation-1:instagram:2026-10-27T10:00:00.000Z",
  attempt: 1,
  result: "retryable_failure",
  nextAction: "retry",
  adapter: "owned",
  recordedAt: "2026-10-27T10:00:01.000Z",
};
const record: RecoveryRecord = { schema: "izakhono.marketing.recovery-record.v1", sequence: 1, receipt };

let queried = false;
const registry = new ProviderObservationRegistry();
registry.register(new CredentialGatedProviderObservationAdapter("owned", true, async (candidate) => {
  queried = true;
  return {
    idempotencyKey: candidate.receipt.idempotencyKey,
    executionId: candidate.receipt.executionId,
    observedAt: "2026-10-27T10:00:02.000Z",
    providerResult: "success",
  };
}));

const observation = await registry.observe(record);
assert.equal(queried, true);
assert.equal(observation.providerResult, "success");

const gated = new CredentialGatedProviderObservationAdapter("owned", false, async () => {
  throw new Error("must not execute");
});
await assert.rejects(() => gated.observe(record), /credentials are not configured/);

await assert.rejects(
  () => registry.observe({ ...record, receipt: { ...receipt, adapter: "metricool" } }),
  /No provider observation adapter registered/,
);

console.log("provider observation boundary tests passed");
