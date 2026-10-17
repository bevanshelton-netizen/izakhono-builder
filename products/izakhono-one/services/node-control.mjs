import { authorizeRequest } from './fortress.mjs';

export const nodeStates = Object.freeze(['discovered','registered','ready','draining','offline']);

function now() { return new Date().toISOString(); }
function text(value) { return String(value || '').trim(); }

export function normalizeNode(input = {}) {
  const nodeId = text(input.node_id);
  const environment = text(input.environment) || 'production';
  const capabilities = Array.isArray(input.capabilities) ? [...new Set(input.capabilities.map(text).filter(Boolean))] : [];
  const state = nodeStates.includes(input.state) ? input.state : 'discovered';
  return {
    node_id: nodeId,
    environment,
    capabilities,
    runtime_version: text(input.runtime_version) || 'unknown',
    state,
    health: text(input.health) || 'unknown',
    last_seen_at: input.last_seen_at || null,
    revision: text(input.revision) || null,
    security_posture: input.security_posture === 'ready' ? 'ready' : 'unknown',
    registered_at: input.registered_at || null,
    desired_workload: input.desired_workload || null
  };
}

function authorize(principal, action, nodeId, sensitive = true) {
  return authorizeRequest({ principal, action, resource: `service:node-control:${nodeId}`, sensitive });
}

export function registerNode(store, input = {}) {
  const node = normalizeNode(input.node);
  if (!node.node_id) return { ok:false, reason:'node_id_required' };
  const gate = authorize(input.principal, 'manage', node.node_id, true);
  if (gate.decision !== 'allow') return { ok:false, reason:`fortress_${gate.decision}`, gate };
  const existing = store.get(node.node_id);
  const registered = normalizeNode({ ...existing, ...node, state:'registered', registered_at:existing?.registered_at || now(), last_seen_at:now() });
  store.set(node.node_id, registered);
  return { ok:true, node:registered, gate };
}

export function heartbeatNode(store, input = {}) {
  const nodeId = text(input.node_id);
  if (!nodeId) return { ok:false, reason:'node_id_required' };
  const existing = store.get(nodeId);
  if (!existing) return { ok:false, reason:'node_not_registered' };
  const updated = normalizeNode({ ...existing, health:text(input.health) || existing.health, revision:text(input.revision) || existing.revision, last_seen_at:now() });
  if (updated.state === 'registered' && updated.health === 'healthy' && updated.security_posture === 'ready') updated.state = 'ready';
  if (updated.state === 'ready' && updated.health !== 'healthy') updated.state = 'registered';
  store.set(nodeId, updated);
  return { ok:true, node:updated };
}

export function authorizeWorkload(store, input = {}) {
  const nodeId = text(input.node_id);
  const revision = text(input.revision);
  if (!nodeId || !revision) return { ok:false, reason:'node_and_revision_required' };
  const existing = store.get(nodeId);
  if (!existing) return { ok:false, reason:'node_not_registered' };
  const gate = authorize(input.principal, 'execute', nodeId, true);
  if (gate.decision !== 'allow') return { ok:false, reason:`fortress_${gate.decision}`, gate };
  if (existing.state === 'draining' || existing.state === 'offline') return { ok:false, reason:'node_not_deployable', node:existing, gate };
  if (existing.health !== 'healthy') return { ok:false, reason:'node_not_healthy', node:existing, gate };
  if (existing.security_posture !== 'ready') return { ok:false, reason:'node_security_posture_not_ready', node:existing, gate };
  const desired = normalizeNode({ ...existing, desired_workload:{revision, authorized_at:now()} });
  store.set(nodeId, desired);
  return { ok:true, node:desired, gate };
}

export function recordDeployment(store, input = {}) {
  const nodeId = text(input.node_id);
  const revision = text(input.revision);
  const existing = store.get(nodeId);
  if (!existing) return { ok:false, reason:'node_not_registered' };
  if (!existing.desired_workload || existing.desired_workload.revision !== revision) return { ok:false, reason:'revision_not_authorized' };
  if (existing.health !== 'healthy' || existing.security_posture !== 'ready') return { ok:false, reason:'node_not_ready' };
  const deployed = normalizeNode({ ...existing, revision, state:'ready', last_seen_at:now() });
  deployed.desired_workload = { ...existing.desired_workload, deployed_at:now() };
  store.set(nodeId, deployed);
  return { ok:true, node:deployed, deployment_verified:true };
}

export function drainNode(store, input = {}) {
  const nodeId = text(input.node_id);
  const existing = store.get(nodeId);
  if (!existing) return { ok:false, reason:'node_not_registered' };
  const gate = authorize(input.principal, 'manage', nodeId, true);
  if (gate.decision !== 'allow') return { ok:false, reason:`fortress_${gate.decision}`, gate };
  const drained = normalizeNode({ ...existing, state:'draining' });
  store.set(nodeId, drained);
  return { ok:true, node:drained, gate };
}

export function listReadyNodes(store) {
  return [...store.values()].filter(node => node.state === 'ready' && node.health === 'healthy' && node.security_posture === 'ready').map(normalizeNode);
}

export function createNodeStore(initial = []) {
  const map = new Map();
  for (const item of initial) {
    const node = normalizeNode(item);
    if (node.node_id) map.set(node.node_id, node);
  }
  return map;
}
