/**
 * Read-only bridge from IZAKHONO DEPLOY to the existing shared software-node registry.
 * It selects eligible execution targets but never creates or promotes a runtime.
 */
import { selectReadyNode, listNodes } from "../autonomy/node-registry.mjs";

export const REQUIRED_DEPLOYMENT_CHECKS = Object.freeze([
  "nodeReachable",
  "persistentStorageReady",
  "containerRuntimeReady",
  "monitoringOnline",
  "backupReady"
]);

export function inspectDeploymentTargets({ now } = {}) {
  // The shared registry computes freshness from its control-plane receipt timestamp.
  const nodes = listNodes();
  const selection = selectReadyNode({ requiredChecks: [...REQUIRED_DEPLOYMENT_CHECKS] });
  const eligible = nodes.filter(node =>
    node.health === "online" &&
    node.status === "healthy" &&
    REQUIRED_DEPLOYMENT_CHECKS.every(check => node.readiness?.[check] === true) &&
    typeof node.runtime?.runtime_host === "string" &&
    node.runtime.runtime_host.trim().length > 0 &&
    node.runtime.runtime_host_is_separate === true
  );
  const selected = selection.status === "ready"
    ? eligible.find(node => node.nodeId === selection.nodeId) || null
    : null;
  return Object.freeze({
    mode: "read-only",
    logical_node_identity: "NODE01",
    identity_type: "software-runtime",
    runtime_host_is_separate: true,
    status: selected ? "ready" : "waiting",
    reason: selected ? "eligible-runtime-binding-found" : selection.reason || "no-runtime-binding-passed-policy",
    required_checks: REQUIRED_DEPLOYMENT_CHECKS,
    selected_target: selected ? Object.freeze({
      node_id: selected.nodeId,
      runtime_host: selected.runtime.runtime_host,
      runtime_binding_verified: true,
      heartbeat_received_at: selected.receivedAt,
      readiness: selected.readiness
    }) : null,
    candidates: nodes.map(node => ({
      node_id: node.nodeId,
      health: node.health,
      status: node.status,
      runtime_binding_present: Boolean(node.runtime?.runtime_host),
      runtime_binding_separate: node.runtime?.runtime_host_is_separate === true,
      missing_checks: REQUIRED_DEPLOYMENT_CHECKS.filter(check => node.readiness?.[check] !== true)
    }))
  });
}
