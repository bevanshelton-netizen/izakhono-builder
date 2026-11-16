import assert from "node:assert/strict";
import { ThorError } from "./index.mjs";
import { validateReleaseEnvelope, executeApprovedRelease } from "./provisioner-contract.mjs";

const digest = "a".repeat(64);
const release = {
  releaseId: "rel-001",
  projectId: "project-alpha",
  environment: "preview",
  artifact: { digest, uri: "oci://registry.izakhono.local/apps/alpha@sha256:" + digest },
  target: {
    kind: "owned-node",
    logicalNodeId: "NODE01",
    runtimeHostRef: "runtime-host-01",
    runtimeHostIsSeparate: true,
  },
  approval: {
    status: "approved",
    approvalId: "approval-001",
    approvedBy: "owner-001",
    approvedAt: "2026-11-16T12:00:00.000Z",
    scope: {
      projectId: "project-alpha",
      artifactDigest: digest,
      logicalNodeId: "NODE01",
      environment: "preview",
    },
  },
};

const normalized = validateReleaseEnvelope(release);
assert.equal(normalized.idempotencyKey, "thor-release:rel-001");
assert.equal(normalized.target.logicalNodeId, "NODE01");
assert.equal(normalized.target.runtimeHostIsSeparate, true);
assert.equal(normalized.artifact.digest, digest);

for (const [patch, code] of [
  [{ approval: { ...release.approval, status: "pending" } }, "APPROVAL_REQUIRED"],
  [{ artifact: { ...release.artifact, digest: "not-a-digest" } }, "INVALID_ARTIFACT"],
  [{ target: { ...release.target, runtimeHostIsSeparate: false } }, "INVALID_TARGET"],
  [{ approval: { ...release.approval, scope: { ...release.approval.scope, artifactDigest: "b".repeat(64) } } }, "APPROVAL_SCOPE_MISMATCH"],
  [{ environment: "production", approval: { ...release.approval, scope: { ...release.approval.scope, environment: "preview" } } }, "APPROVAL_SCOPE_MISMATCH"],
]) {
  assert.throws(() => validateReleaseEnvelope({ ...release, ...patch }), error =>
    error instanceof ThorError && error.code === code);
}

const calls = [];
const adapter = {
  async authorize(ctx) { calls.push(["authorize", ctx.approval.approvalId]); return { authorized: true, evidenceRef: "auth-evidence-001" }; },
  async plan(ctx) {
    calls.push(["plan", ctx.idempotencyKey]);
    return { ready: true, planId: "plan-001" };
  },
  async provision(ctx) {
    calls.push(["provision", ctx.planId]);
    return { status: "deployed", deploymentId: "deployment-001" };
  },
  async verify(ctx) {
    calls.push(["verify", ctx.deploymentId]);
    return { status: "verified", evidenceRef: "evidence-001" };
  },
  async handover(ctx) {
    calls.push(["handover", ctx.verificationEvidenceRef]);
    return { status: "ready", packageRef: "handover-001" };
  },
};

const result = await executeApprovedRelease(release, adapter);
assert.deepEqual(calls.map(call => call[0]), ["authorize", "plan", "provision", "verify", "handover"]);
assert.equal(result.state, "handed_over");
assert.equal(result.handoverPackageRef, "handover-001");
assert.equal(result.approvalEvidenceRef, "auth-evidence-001");

let provisionCalled = false;
await assert.rejects(
  executeApprovedRelease(
    { ...release, approval: { ...release.approval, status: "pending" } },
    { ...adapter, async provision() { provisionCalled = true; } },
  ),
  error => error instanceof ThorError && error.code === "APPROVAL_REQUIRED",
);
assert.equal(provisionCalled, false, "provisioning must never run before approval validation");

let authorizePlanCalled = false;
await assert.rejects(
  executeApprovedRelease(release, {
    ...adapter,
    async authorize() { return { authorized: false }; },
    async plan() { authorizePlanCalled = true; return { ready: true, planId: "plan-002" }; },
  }),
  error => error instanceof ThorError && error.code === "APPROVAL_NOT_AUTHORIZED",
);
assert.equal(authorizePlanCalled, false, "planning must stop when authoritative approval verification fails");

let verifyCalled = false;
await assert.rejects(
  executeApprovedRelease(release, {
    ...adapter,
    async provision() { return { status: "unknown", deploymentId: "deployment-002" }; },
    async verify() { verifyCalled = true; return { status: "verified", evidenceRef: "evidence-002" }; },
  }),
  error => error instanceof ThorError && error.code === "PROVISION_DEPLOY_FAILED",
);
assert.equal(verifyCalled, false, "verification must not run after an unconfirmed deployment");

console.log("THOR -> Provisioner contract: all tests passed.");
