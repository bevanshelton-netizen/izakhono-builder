/**
 * IZAKHONO DEPLOY lifecycle policy.
 * Pure policy module: callers persist returned records transactionally and enforce
 * unique (deployment_id, idempotency_key). No command execution or network access.
 */
export const DEPLOYMENT_STATES = Object.freeze([
  "DISCOVERED", "VALIDATED", "BUILT", "TESTED", "APPROVED",
  "RELEASED", "HEALTHY", "VERIFIED", "FAILED"
]);
const NEXT = Object.freeze({
  DISCOVERED: "VALIDATED", VALIDATED: "BUILT", BUILT: "TESTED",
  TESTED: "APPROVED", APPROVED: "RELEASED", RELEASED: "HEALTHY", HEALTHY: "VERIFIED"
});
export class DeploymentPolicyError extends Error {
  constructor(code, message) { super(message); this.name = "DeploymentPolicyError"; this.code = code; }
}
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
const sha256 = value => typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
const gitSha = value => typeof value === "string" && /^[a-f0-9]{40,64}$/i.test(value);
function requireEvidence(ok, code, message) {
  if (!ok) throw new DeploymentPolicyError(code, message);
}
function cloneSafeEvidence(value, path = "evidence") {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item, index) => cloneSafeEvidence(item, path + "[" + index + "]"));
  requireEvidence(value && typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
    "EVIDENCE_NOT_JSON", "Evidence must contain only plain JSON values.");
  const copy = {};
  for (const [key, item] of Object.entries(value)) {
    requireEvidence(!["__proto__", "prototype", "constructor"].includes(key),
      "EVIDENCE_KEY_INVALID", "Evidence contains a prohibited object key.");
    requireEvidence(!/(secret|token|password|authorization|private.?key|credential)/i.test(key),
      "SECRET_EVIDENCE_REJECTED", "Secret or credential material must never be stored in deployment evidence.");
    copy[key] = cloneSafeEvidence(item, path + "." + key);
  }
  return copy;
}
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
function validateEvidence(state, e, current) {
  requireEvidence(e && typeof e === "object" && !Array.isArray(e), "EVIDENCE_REQUIRED", "Structured evidence is required.");
  switch (state) {
    case "VALIDATED":
      requireEvidence(gitSha(e.source_commit), "SOURCE_COMMIT_INVALID", "A full Git commit SHA is required.");
      requireEvidence(e.source_commit.toLowerCase() === current.source_commit.toLowerCase(), "SOURCE_COMMIT_MISMATCH", "Validated source commit must match the deployment source commit.");
      requireEvidence(e.policy_passed === true, "POLICY_NOT_PASSED", "Policy checks must pass before building."); break;
    case "BUILT":
      requireEvidence(sha256(e.image_digest), "IMAGE_DIGEST_INVALID", "An immutable sha256 image digest is required.");
      requireEvidence(nonEmpty(e.artifact_reference), "ARTIFACT_REFERENCE_REQUIRED", "An artifact reference is required."); break;
    case "TESTED":
      requireEvidence(e.tests_passed === true, "TESTS_NOT_PASSED", "Required tests must pass.");
      requireEvidence(Array.isArray(e.test_run_ids) && e.test_run_ids.length > 0, "TEST_EVIDENCE_REQUIRED", "Test run references are required."); break;
    case "APPROVED":
      requireEvidence(nonEmpty(e.approval_id) && nonEmpty(e.approved_by), "APPROVAL_REQUIRED", "Attributable human approval is required.");
      requireEvidence(nonEmpty(e.approved_at), "APPROVAL_TIMESTAMP_REQUIRED", "Approval timestamp is required."); break;
    case "RELEASED":
      requireEvidence(nonEmpty(e.deployment_id) && nonEmpty(e.target_id), "RELEASE_TARGET_REQUIRED", "Deployment and selected target IDs are required.");
      requireEvidence(sha256(e.image_digest), "RELEASE_DIGEST_INVALID", "Release must reference an immutable image digest."); break;
    case "HEALTHY":
      requireEvidence(e.health_check_passed === true && nonEmpty(e.health_checked_at), "HEALTH_NOT_VERIFIED", "A successful runtime health check and timestamp are required."); break;
    case "VERIFIED":
      requireEvidence(e.https_check_passed === true && e.acceptance_verified === true && nonEmpty(e.verified_at),
        "VERIFICATION_INCOMPLETE", "Independent HTTPS and acceptance checks are required."); break;
  }
}
export function createDeployment({ deploymentId, applicationId, sourceCommit, createdAt }) {
  requireEvidence(nonEmpty(deploymentId) && nonEmpty(applicationId), "IDENTITY_REQUIRED", "Deployment and application IDs are required.");
  requireEvidence(gitSha(sourceCommit), "SOURCE_COMMIT_INVALID", "A full Git commit SHA is required.");
  requireEvidence(nonEmpty(createdAt), "TIMESTAMP_REQUIRED", "Creation timestamp is required.");
  return Object.freeze({
    deployment_id: deploymentId, application_id: applicationId, source_commit: sourceCommit,
    state: "DISCOVERED", created_at: createdAt, updated_at: createdAt,
    evidence: Object.freeze({}), history: Object.freeze([])
  });
}
export function transitionDeployment(current, nextState, evidence, { actor, at, idempotencyKey } = {}) {
  requireEvidence(current && DEPLOYMENT_STATES.includes(current.state), "DEPLOYMENT_INVALID", "A valid deployment record is required.");
  requireEvidence(nonEmpty(actor) && nonEmpty(at) && nonEmpty(idempotencyKey), "AUDIT_CONTEXT_REQUIRED",
    "Actor, timestamp and idempotency key are required.");
  requireEvidence(nextState !== "FAILED" && NEXT[current.state] === nextState, "INVALID_TRANSITION",
    "Transition from " + current.state + " to " + nextState + " is not permitted.");
  const safeEvidence = deepFreeze(cloneSafeEvidence(evidence));
  validateEvidence(nextState, safeEvidence, current);
  if (nextState === "RELEASED") requireEvidence(safeEvidence.image_digest === current.evidence.image_digest,
    "DIGEST_MISMATCH", "Released image digest must match the tested build artifact.");
  const event = Object.freeze({ from: current.state, to: nextState, actor, at,
    idempotency_key: idempotencyKey, evidence: safeEvidence });
  return Object.freeze({ ...current, state: nextState, updated_at: at,
    evidence: deepFreeze({ ...current.evidence, ...safeEvidence }),
    history: Object.freeze([...current.history, event]) });
}
export function failDeployment(current, { actor, at, reason, idempotencyKey } = {}) {
  requireEvidence(current && DEPLOYMENT_STATES.includes(current.state) && !["VERIFIED", "FAILED"].includes(current.state),
    "INVALID_FAILURE_STATE", "This deployment cannot fail from its current state.");
  requireEvidence(nonEmpty(actor) && nonEmpty(at) && nonEmpty(reason) && nonEmpty(idempotencyKey),
    "AUDIT_CONTEXT_REQUIRED", "Failure requires actor, timestamp, reason and idempotency key.");
  const event = Object.freeze({ from: current.state, to: "FAILED", actor, at, reason, idempotency_key: idempotencyKey });
  return Object.freeze({ ...current, state: "FAILED", updated_at: at,
    evidence: Object.freeze({ ...current.evidence, failure_reason: reason }),
    history: Object.freeze([...current.history, event]) });
}
