import test from "node:test";
import assert from "node:assert/strict";
import { inspectResourceEnforcement, evaluateManagedWorkloadLaunch } from "../src/resource-enforcement.mjs";

test("Linux preflight detects required cgroup v2 controllers without claiming enforcement", async () => {
  const result = await inspectResourceEnforcement({
    platform: "linux",
    probeLinuxCgroupV2: async () => ({ mounted: true, controllers: ["cpu", "memory", "io", "pids"] })
  });
  assert.equal(result.mechanismDetected, true);
  assert.equal(result.available, true);
  assert.equal(result.enforcementReady, false);
  assert.equal(result.isolationReady, false);
  assert.equal(result.canLaunchManagedWorkloads, false);
  assert.equal(result.mode, "read-only-preflight");
});

test("Linux preflight fails closed when controllers are missing", async () => {
  const result = await inspectResourceEnforcement({
    platform: "linux",
    probeLinuxCgroupV2: async () => ({ mounted: true, controllers: ["cpu", "memory"] })
  });
  assert.equal(result.available, false);
  assert.deepEqual(result.missingControllers, ["io", "pids"]);
});

test("failed Linux probe does not enable workloads", async () => {
  const result = await inspectResourceEnforcement({
    platform: "linux",
    probeLinuxCgroupV2: async () => { throw new Error("permission denied"); }
  });
  assert.equal(result.enforcementReady, false);
  assert.equal(result.canLaunchManagedWorkloads, false);
});

test("Windows and macOS remain explicitly unimplemented", async () => {
  for (const platform of ["win32", "darwin"]) {
    const result = await inspectResourceEnforcement({ platform });
    assert.equal(result.enforcementReady, false);
    assert.equal(result.isolationReady, false);
    assert.equal(result.canLaunchManagedWorkloads, false);
  }
});

test("policy approval alone cannot authorize a managed workload", () => {
  const result = evaluateManagedWorkloadLaunch({
    policyDecision: { allowed: true },
    enforcement: { enforcementReady: false },
    isolation: { ready: false }
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.reasons, ["os-enforcement-unverified", "workload-isolation-unverified"]);
});

test("launch gate only passes when policy, enforcement and isolation are verified", () => {
  const result = evaluateManagedWorkloadLaunch({
    policyDecision: { allowed: true },
    enforcement: { enforcementReady: true },
    isolation: { ready: true }
  });
  assert.equal(result.allowed, true);
  assert.equal(result.executionEnabled, false);
});
