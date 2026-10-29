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
