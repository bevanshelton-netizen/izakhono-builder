import { deploymentTarget } from './node-control-plane.mjs';

/**
 * Select a replacement owned NODE without silently falling back to external infrastructure.
 * The caller supplies the failed node so it is excluded from the next selection.
 */
export function selectFailoverTarget(failedNodeId, requirements = {}) {
  const target = deploymentTarget({
    ...requirements,
    excludeNodeIds: [
      ...(requirements.excludeNodeIds || []),
      ...(failedNodeId ? [failedNodeId] : []),
    ],
  });

  if (target.status !== 'ready') {
    return {
      status: 'waiting',
      reason: target.reason || 'no-owned-failover-node',
      failedNodeId: failedNodeId || null,
      target,
    };
  }

  return {
    status: 'ready',
    failedNodeId: failedNodeId || null,
    replacementNodeId: target.nodeId,
    target,
  };
}

/**
 * Resolve a failover request from the control plane.
 * No failed NODE means no failover is required; a failed NODE requires a
 * fresh, healthy, readiness-qualified replacement and never external fallback.
 */
export function resolveFailover(requirements = {}, failedNodeId = process.env.IZAKHONO_FAILED_NODE_ID || null) {
  if (!failedNodeId) {
    return {
      status: 'not_required',
      reason: 'no-failed-node-declared',
      failedNodeId: null,
    };
  }

  return selectFailoverTarget(failedNodeId, requirements);
}
