import test from "node:test";
import assert from "node:assert/strict";
import { createDeployment, transitionDeployment, failDeployment, DeploymentPolicyError } from "./lifecycle.mjs";
const commit = "a".repeat(40), digest = "sha256:" + "b".repeat(64);
const base = () => createDeployment({ deploymentId: "dep-001", applicationId: "app-001", sourceCommit: commit, createdAt: "2026-11-22T00:00:00Z" });
const move = (record, state, evidence, n) => transitionDeployment(record, state, evidence, {
  actor: "owner:test", at: "2026-11-22T00:00:0" + n + "Z", idempotencyKey: "key-" + n
});
test("requires sequential lifecycle transitions and immutable artifact evidence", () => {
  let d = base();
  d = move(d, "VALIDATED", { source_commit: commit, policy_passed: true }, 1);
  d = move(d, "BUILT", { image_digest: digest, artifact_reference: "registry/app@sha256" }, 2);
  d = move(d, "TESTED", { tests_passed: true, test_run_ids: ["ci-123"] }, 3);
  d = move(d, "APPROVED", { approval_id: "approval-1", approved_by: "owner", approved_at: "2026-11-22T00:00:04Z" }, 4);
  d = move(d, "RELEASED", { deployment_id: "release-1", target_id: "verified-target", image_digest: digest }, 5);
  d = move(d, "HEALTHY", { health_check_passed: true, health_checked_at: "2026-11-22T00:00:06Z" }, 6);
  d = move(d, "VERIFIED", { https_check_passed: true, acceptance_verified: true, verified_at: "2026-11-22T00:00:07Z" }, 7);
  assert.equal(d.state, "VERIFIED"); assert.equal(d.history.length, 7);
});
test("blocks skipped states and missing production approval", () => {
  const d = base();
  assert.throws(() => move(d, "BUILT", { image_digest: digest, artifact_reference: "x" }, 1),
    e => e instanceof DeploymentPolicyError && e.code === "INVALID_TRANSITION");
  const v = move(d, "VALIDATED", { source_commit: commit, policy_passed: true }, 1);
  const b = move(v, "BUILT", { image_digest: digest, artifact_reference: "x" }, 2);
  const t = move(b, "TESTED", { tests_passed: true, test_run_ids: ["ci"] }, 3);
  assert.throws(() => move(t, "APPROVED", {}, 4), e => e.code === "APPROVAL_REQUIRED");
});
test("blocks a release whose digest differs from the tested build", () => {
  let d = base();
  d = move(d, "VALIDATED", { source_commit: commit, policy_passed: true }, 1);
  d = move(d, "BUILT", { image_digest: digest, artifact_reference: "x" }, 2);
  d = move(d, "TESTED", { tests_passed: true, test_run_ids: ["ci"] }, 3);
  d = move(d, "APPROVED", { approval_id: "a", approved_by: "owner", approved_at: "now" }, 4);
  assert.throws(() => move(d, "RELEASED", { deployment_id: "r", target_id: "t", image_digest: "sha256:" + "c".repeat(64) }, 5),
    e => e.code === "DIGEST_MISMATCH");
});
test("failure is auditable and terminal in this lifecycle", () => {
  const failed = failDeployment(base(), { actor: "system:policy", at: "2026-11-22T00:00:01Z",
    reason: "runtime binding unverified", idempotencyKey: "fail-1" });
  assert.equal(failed.state, "FAILED");
  assert.throws(() => move(failed, "VALIDATED", { source_commit: commit, policy_passed: true }, 2),
    e => e.code === "INVALID_TRANSITION");
});
