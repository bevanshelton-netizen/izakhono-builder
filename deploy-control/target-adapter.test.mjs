import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "izakhono-deploy-target-"));
process.env.IZAKHONO_NODE_REGISTRY_PATH = path.join(temp, "registry.json");
process.env.IZAKHONO_NODE_STALE_MS = "180000";
const registry = await import("../autonomy/node-registry.mjs");
const { inspectDeploymentTargets } = await import("./target-adapter.mjs");

const checks = {
  nodeReachable: true, persistentStorageReady: true, containerRuntimeReady: true,
  monitoringOnline: true, backupReady: true
};
function heartbeat(nodeId, runtime, readiness = checks) {
  return registry.recordHeartbeat({
    nodeId, status: "healthy", health: "healthy", checks: readiness,
    identity: { logical_node_id: "NODE01", identity_type: "software-runtime" },
    runtime, timestamp: new Date().toISOString(), capacity: { loadAverage: [0.1] }
  });
}

test("returns waiting when there are no registered execution targets", () => {
  const result = inspectDeploymentTargets();
  assert.equal(result.mode, "read-only");
  assert.equal(result.status, "waiting");
  assert.equal(result.selected_target, null);
});

test("rejects healthy nodes without separate verified runtime binding", () => {
  heartbeat("candidate-no-binding", { runtime: "container" });
  const result = inspectDeploymentTargets();
  assert.equal(result.status, "waiting");
  assert.equal(result.selected_target, null);
});

test("treats a fresh healthy node with separate runtime binding as a candidate, not authorized execution", () => {
  heartbeat("candidate-ready", {
    runtime: "container",
    runtime_host: "owner-runtime-binding-01",
    runtime_host_is_separate: true
  });
  const result = inspectDeploymentTargets();
  assert.equal(result.status, "waiting");
  assert.equal(result.execution_authorized, false);
  assert.equal(result.selected_target, null);
  assert.equal(result.logical_node_identity, "NODE01");
  assert.equal(result.identity_type, "software-runtime");
  assert.equal(result.candidate_target.node_id, "candidate-ready");
  assert.equal(result.candidate_target.runtime_binding_declared, true);
  assert.equal(result.candidate_target.runtime_binding_verified, false);
  assert.equal(result.candidate_target.owner_execution_authorized, false);
});

test("does not select a node missing backup readiness", () => {
  heartbeat("candidate-no-backup", {
    runtime_host: "owner-runtime-binding-02",
    runtime_host_is_separate: true
  }, { ...checks, backupReady: false });
  const result = inspectDeploymentTargets();
  assert.equal(result.status, "waiting");
  assert.equal(result.selected_target, null);
  assert.equal(result.candidate_target.node_id, "candidate-ready");
  assert.ok(result.candidates.find(x => x.node_id === "candidate-no-backup").missing_checks.includes("backupReady"));
});

test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
