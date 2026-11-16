/**
 * THOR -> IZAKHONO Provisioner integration contract.
 *
 * THOR owns build planning and immutable artifacts. The shared Provisioner
 * owns infrastructure allocation and deployment execution. Domain-specific
 * provisioning products (including I-CONNECT telecom provisioning) remain
 * separate adapters and state machines.
 *
 * This module is an approval/evidence gate and adapter contract. It does not
 * provision infrastructure itself and must never receive provider secrets.
 */
import { ThorError } from "./index.mjs";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const SHA256 = /^[a-f0-9]{64}$/i;
const NODE = /^NODE(?:0[1-9]|[1-9][0-9])$/;

function requireValue(condition, message, code) {
  if (!condition) throw new ThorError(message, code);
}

function safeRef(value) {
  return typeof value === "string" && ID.test(value);
}

export function validateReleaseEnvelope(input) {
  requireValue(input && typeof input === "object" && !Array.isArray(input), "Release envelope is required", "INVALID_RELEASE");
  const { releaseId, projectId, artifact, target, approval, environment } = input;
  requireValue(safeRef(releaseId), "Invalid releaseId", "INVALID_RELEASE");
  requireValue(safeRef(projectId), "Invalid projectId", "INVALID_RELEASE");
  requireValue(environment === "preview" || environment === "production", "Environment must be preview or production", "INVALID_ENVIRONMENT");
  requireValue(artifact && typeof artifact === "object", "Immutable artifact metadata is required", "INVALID_ARTIFACT");
  requireValue(typeof artifact.digest === "string" && SHA256.test(artifact.digest), "Artifact must have a SHA-256 digest", "INVALID_ARTIFACT");
  requireValue(typeof artifact.uri === "string" && /^(https:\/\/|oci:\/\/)[^\s]+$/i.test(artifact.uri), "Artifact URI must be HTTPS or OCI", "INVALID_ARTIFACT");
  requireValue(target && typeof target === "object", "Deployment target is required", "INVALID_TARGET");
  requireValue(target.kind === "owned-node" || target.kind === "approved-fallback", "Target must be owned-node or an approved fallback", "INVALID_TARGET");
  requireValue(typeof target.logicalNodeId === "string" && NODE.test(target.logicalNodeId), "A logical NODE identity is required", "INVALID_TARGET");
  requireValue(safeRef(target.runtimeHostRef), "A separately verified runtime host reference is required", "INVALID_TARGET");
  requireValue(target.runtimeHostIsSeparate === true, "Runtime host must remain separate from the logical NODE identity", "INVALID_TARGET");
  requireValue(approval && approval.status === "approved", "A recorded release approval is required", "APPROVAL_REQUIRED");
  requireValue(safeRef(approval.approvalId) && safeRef(approval.approvedBy), "Approval identity and approver are required", "APPROVAL_REQUIRED");
  requireValue(typeof approval.approvedAt === "string" && Number.isFinite(Date.parse(approval.approvedAt)), "Approval timestamp is invalid", "APPROVAL_REQUIRED");
  requireValue(approval.scope && approval.scope.projectId === projectId
    && approval.scope.artifactDigest?.toLowerCase() === artifact.digest.toLowerCase()
    && approval.scope.logicalNodeId === target.logicalNodeId
    && approval.scope.environment === environment,
  "Approval does not cover this exact project, artifact, node and environment", "APPROVAL_SCOPE_MISMATCH");
  return Object.freeze({
    releaseId, projectId, environment,
    artifact: Object.freeze({ digest: artifact.digest.toLowerCase(), uri: artifact.uri }),
    target: Object.freeze({
      kind: target.kind,
      logicalNodeId: target.logicalNodeId,
      runtimeHostRef: target.runtimeHostRef,
      runtimeHostIsSeparate: true,
    }),
    approval: Object.freeze({
      approvalId: approval.approvalId,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
    }),
    idempotencyKey: `thor-release:${releaseId}`,
  });
}

function requireAdapter(adapter) {
  for (const method of ["plan", "provision", "verify", "handover"]) {
    requireValue(typeof adapter?.[method] === "function", `Provisioner adapter must implement ${method}()`, "INVALID_PROVISIONER_ADAPTER");
  }
}

export async function executeApprovedRelease(input, adapter) {
  const release = validateReleaseEnvelope(input);
  requireAdapter(adapter);

  const context = Object.freeze({
    releaseId: release.releaseId,
    projectId: release.projectId,
    environment: release.environment,
    artifact: release.artifact,
    target: release.target,
    approval: release.approval,
    idempotencyKey: release.idempotencyKey,
  });

  const plan = await adapter.plan(context);
  requireValue(plan?.ready === true && safeRef(plan.planId), "Provisioner plan is not ready", "PROVISION_PLAN_BLOCKED");

  const deployment = await adapter.provision({ ...context, planId: plan.planId });
  requireValue(deployment?.status === "deployed" && safeRef(deployment.deploymentId),
    "Provisioner did not confirm deployment", "PROVISION_DEPLOY_FAILED");

  const verification = await adapter.verify({ ...context, planId: plan.planId, deploymentId: deployment.deploymentId });
  requireValue(verification?.status === "verified" && safeRef(verification.evidenceRef),
    "Independent deployment verification did not pass", "PROVISION_VERIFY_FAILED");

  const handover = await adapter.handover({
    ...context,
    planId: plan.planId,
    deploymentId: deployment.deploymentId,
    verificationEvidenceRef: verification.evidenceRef,
  });
  requireValue(handover?.status === "ready" && safeRef(handover.packageRef),
    "Provisioner did not produce a verified handover package", "PROVISION_HANDOVER_FAILED");

  return Object.freeze({
    releaseId: release.releaseId,
    state: "handed_over",
    planId: plan.planId,
    deploymentId: deployment.deploymentId,
    verificationEvidenceRef: verification.evidenceRef,
    handoverPackageRef: handover.packageRef,
    idempotencyKey: release.idempotencyKey,
  });
}
