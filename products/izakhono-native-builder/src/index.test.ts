import { strict as assert } from "node:assert";
import { NativeBuilderCore, MemoryBuilderStore, type BuilderClock } from "./index.js";

async function runNativeBuilderTest(): Promise<void> {
const store = new MemoryBuilderStore();
let sequence = 0;
const clock: BuilderClock = {
  now: () => "2026-11-04T08:00:00.000Z",
  id: () => `test_${++sequence}`,
};
const core = new NativeBuilderCore(store, clock);

await core.registerProject({
  id: "demo-app",
  name: "Demo App",
  description: "Builder core test project",
  sourceOfTruth: "izakhono_internal",
  status: "editable",
  dependencies: [],
});

const routine = await core.requestBuild({
  projectId: "demo-app",
  instruction: "Add a contact page",
  requestedBy: "owner",
  risk: "routine",
});
assert.equal(routine.status, "queued");
assert.equal(routine.requiresApproval, false);
await core.advance(routine.id, "planning", "Plan created.");
await core.advance(routine.id, "running", "Worker started.");
await core.advance(routine.id, "testing", "Tests started.");
await core.advance(routine.id, "packaging", "Release packaged.");
await core.advance(routine.id, "succeeded", "Local validation succeeded.");

const sensitive = await core.requestBuild({
  projectId: "demo-app",
  instruction: "Change payment settlement destination",
  requestedBy: "owner",
  risk: "financial",
  productionRelease: true,
});
assert.equal(sensitive.requiresApproval, true);
await core.advance(sensitive.id, "planning", "Plan created.");
await core.advance(sensitive.id, "awaiting_approval", "Owner approval required.");
await assert.rejects(
  () => core.approveJob(sensitive.id, "owner"),
  /distinct authorised approver/,
);
await assert.rejects(
  () => core.advance(sensitive.id, "running", "Attempt to bypass approval."),
  /not permitted|Approval is required/,
);
const approved = await core.approveJob(sensitive.id, "independent-admin");
assert.equal(approved.status, "running");
assert.equal(approved.approvedBy, "independent-admin");

console.log("IZAKHONO Native Builder Core: all tests passed.");
}

void runNativeBuilderTest().catch((error) => { console.error(error); process.exitCode = 1; });
