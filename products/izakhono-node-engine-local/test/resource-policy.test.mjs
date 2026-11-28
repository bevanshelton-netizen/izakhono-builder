import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RESOURCE_POLICY, evaluateWorkloadAdmission, validateResourcePolicy } from "../src/resource-policy.mjs";

test("accepts the documented default policy", () => {
  assert.equal(validateResourcePolicy(DEFAULT_RESOURCE_POLICY).profile, "balanced");
});

test("rejects unknown profiles and unsafe resource bounds", () => {
  assert.throws(() => validateResourcePolicy({ ...DEFAULT_RESOURCE_POLICY, profile: "unlimited" }), /profile/);
  assert.throws(() => validateResourcePolicy({ ...DEFAULT_RESOURCE_POLICY, maxCpuPercent: 0 }), /maxCpuPercent/);
  assert.throws(() => validateResourcePolicy({ ...DEFAULT_RESOURCE_POLICY, maxMemoryMb: 32 }), /maxMemoryMb/);
});

test("admits a workload within the owner-set memory budget", () => {
  const result = evaluateWorkloadAdmission({ policy: DEFAULT_RESOURCE_POLICY, requestedMemoryMb: 256 });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.enforcement, "admission-control-only");
});

test("blocks workloads that exceed memory budget", () => {
  const result = evaluateWorkloadAdmission({ policy: DEFAULT_RESOURCE_POLICY, requestedMemoryMb: 513 });
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.includes("memory-budget-exceeded"));
});

test("owner pause, battery and thermal warning fail closed", () => {
  const result = evaluateWorkloadAdmission({ policy: DEFAULT_RESOURCE_POLICY, requestedMemoryMb: 128, userPaused: true, onBattery: true, thermalWarning: true });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.reasons, ["paused-by-owner", "battery-power", "thermal-warning"]);
});

test("rejects invalid workload estimates", () => {
  assert.throws(() => evaluateWorkloadAdmission({ requestedMemoryMb: -1 }), /non-negative/);
});
