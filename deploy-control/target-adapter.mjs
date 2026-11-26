/**
 * Read-only bridge from IZAKHONO DEPLOY to the existing shared software-node registry.
 * Registry heartbeat data is a declaration, not proof of owner authorization or HOST access.
 */
import { listNodes } from "../autonomy/node-registry.mjs";

export const REQUIRED_DEPLOYMENT_CHECKS = Object.freeze([
  "nodeReachable", "persistentStorageReady", "containerRuntimeReady",
  "monitoringOnline", "backupReady"
]);

export function inspectDeploymentTargets() {
  const nodes = listNodes();
  const candidates = nodes.filter(node =>
    node.health === "online" &&
    node.status === "healthy" &&
    node.identity?.logical_node_id === "NODE01" &&
    node.identity?.identity_type === "software-runtime" &&
    REQUIRED_DEPLOYMENT_CHECKS.every(check => node.readiness?.[check] === true) &&
    typeof node.runtime?.runtime_host === "string" &&
    node.runtime.runtime_host.trim().length > 0 &&
    node.runtime.runtime_host_is_separate === true
  );
  candidates.sort((a, b) => Number(a.capacity?.loadAverage?.[0] ?? Number.MAX_SAFE_INTEGER) -
    Number(b.capacity?.loadAverage?.[0] ?? Number.MAX_SAFE_INTEGER));
  const candidate = candidates[0] || null;
  const candidateTarget = candidate ? Object.freeze({
    node_id: candidate.nodeId,
    runtime_host: candidate.runtime.runtime_host,
    runtime_binding_declared: true,
    runtime_binding_verified: false,
    owner_execution_authorized: false,
    heartbeat_received_at: candidate.receivedAt,
    readiness: candidate.readiness
  }) : null;

  return Object.freeze({
    mode: "read-only",
    logical_node_identity: "NODE01",
    identity_type: "software-runtime",
    status: "waiting",
    reason: candidate ? "owner-runtime-binding-verification-required" : "no-runtime-candidate-passed-readiness-policy",
    required_checks: REQUIRED_DEPLOYMENT_CHECKS,
    selected_target: null,
    candidate_target: candidateTarget,
    execution_authorized: false,
    candidates: nodes.map(node => ({
      node_id: node.nodeId,
      health: node.health,
      status: node.status,
      runtime_binding_declared: Boolean(node.runtime?.runtime_host) &&
        node.runtime.runtime_host_is_separate === true,
      runtime_binding_verified: false,
      owner_execution_authorized: false,
      missing_checks: REQUIRED_DEPLOYMENT_CHECKS.filter(check => node.readiness?.[check] !== true)
    }))
  });
}
