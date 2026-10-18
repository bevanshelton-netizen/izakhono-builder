import { authorizeRequest } from './fortress.mjs';
import { normalizeNode } from './node-control.mjs';

function text(value) { return String(value || '').trim(); }
function now() { return new Date().toISOString(); }

function bearer(headers = {}) {
  const value = headers.authorization || headers.Authorization || '';
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function tokenMap(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function createPersistentNodeControl({ store, controlToken = process.env.IZAKHONO_CONTROL_TOKEN, nodeTokens = process.env.IZAKHONO_NODE_TOKENS_JSON } = {}) {
  const configuredControlToken = text(controlToken);
  const configuredNodeTokens = tokenMap(nodeTokens);

  function controlPrincipal(headers = {}) {
    const supplied = bearer(headers);
    if (!configuredControlToken || supplied !== configuredControlToken) return null;
    return { id: 'izakhono-control', role: 'owner', type: 'control-plane' };
  }

  function nodePrincipal(headers = {}, nodeId) {
    const supplied = bearer(headers);
    const expected = text(configuredNodeTokens[nodeId]);
    if (!expected || supplied !== expected) return null;
    return { id: nodeId, role: 'operator', type: 'owned-node' };
  }

  async function event(nodeId, eventType, payload = {}, correlationId = null) {
    return store.appendEvent({ node_id: nodeId, event_type: eventType, payload, correlation_id: correlationId });
  }

  async function register(headers, input = {}) {
    const principal = controlPrincipal(headers);
    if (!principal) return { ok: false, status: 401, reason: 'control_authentication_required' };
    const node = normalizeNode(input.node);
    if (!node.node_id) return { ok: false, status: 400, reason: 'node_id_required' };
    const gate = authorizeRequest({ principal, action: 'manage', resource: `service:node-control:${node.node_id}`, sensitive: true });
    if (gate.decision !== 'allow') return { ok: false, status: gate.decision === 'review' ? 202 : 403, reason: `fortress_${gate.decision}`, gate };
    const existing = (await store.read(node.node_id)).node;
    const registered = normalizeNode({ ...existing, ...node, state: 'registered', registered_at: existing?.registered_at || now(), last_seen_at: now() });
    const saved = await store.upsert(registered);
    if (!saved.ok) return { ok: false, status: 503, reason: saved.reason };
    await event(node.node_id, 'node.registered', { state: registered.state, environment: registered.environment });
    return { ok: true, node: registered, gate };
  }

  async function heartbeat(headers, input = {}) {
    const nodeId = text(input.node_id);
    const principal = nodePrincipal(headers, nodeId);
    if (!principal) return { ok: false, status: 401, reason: 'node_authentication_required' };
    if (!nodeId) return { ok: false, status: 400, reason: 'node_id_required' };
    const current = await store.read(nodeId);
    if (!current.ok) return { ok: false, status: 503, reason: current.reason };
    if (!current.node) return { ok: false, status: 404, reason: 'node_not_registered' };
    const updated = normalizeNode({ ...current.node, health: text(input.health) || current.node.health, revision: text(input.revision) || current.node.revision, last_seen_at: now() });
    if (updated.state === 'registered' && updated.health === 'healthy' && updated.security_posture === 'ready') updated.state = 'ready';
    if (updated.state === 'ready' && updated.health !== 'healthy') updated.state = 'registered';
    const saved = await store.upsert(updated);
    if (!saved.ok) return { ok: false, status: 503, reason: saved.reason };
    await event(nodeId, 'node.heartbeat', { health: updated.health, state: updated.state, revision: updated.revision });
    return { ok: true, node: updated };
  }

  async function authorizeWorkload(headers, input = {}) {
    const principal = controlPrincipal(headers);
    if (!principal) return { ok: false, status: 401, reason: 'control_authentication_required' };
    const nodeId = text(input.node_id);
    const revision = text(input.revision);
    if (!nodeId || !revision) return { ok: false, status: 400, reason: 'node_and_revision_required' };
    const current = await store.read(nodeId);
    if (!current.ok) return { ok: false, status: 503, reason: current.reason };
    if (!current.node) return { ok: false, status: 404, reason: 'node_not_registered' };
    const gate = authorizeRequest({ principal, action: 'execute', resource: `service:node-control:${nodeId}`, sensitive: true });
    if (gate.decision !== 'allow') return { ok: false, status: gate.decision === 'review' ? 202 : 403, reason: `fortress_${gate.decision}`, gate };
    const existing = current.node;
    if (existing.state === 'draining' || existing.state === 'offline') return { ok: false, status: 409, reason: 'node_not_deployable', node: existing, gate };
    if (existing.health !== 'healthy') return { ok: false, status: 409, reason: 'node_not_healthy', node: existing, gate };
    if (existing.security_posture !== 'ready') return { ok: false, status: 409, reason: 'node_security_posture_not_ready', node: existing, gate };
    const desired = normalizeNode({ ...existing, desired_workload: { revision, authorized_at: now() } });
    const saved = await store.upsert(desired);
    if (!saved.ok) return { ok: false, status: 503, reason: saved.reason };
    await event(nodeId, 'workload.authorized', { revision }, input.correlation_id || null);
    return { ok: true, node: desired, gate };
  }

  async function recordDeployment(headers, input = {}) {
    const principal = controlPrincipal(headers);
    if (!principal) return { ok: false, status: 401, reason: 'control_authentication_required' };
    const nodeId = text(input.node_id);
    const revision = text(input.revision);
    if (!nodeId || !revision) return { ok: false, status: 400, reason: 'node_and_revision_required' };
    const current = await store.read(nodeId);
    if (!current.ok) return { ok: false, status: 503, reason: current.reason };
    if (!current.node) return { ok: false, status: 404, reason: 'node_not_registered' };
    const existing = current.node;
    if (!existing.desired_workload || existing.desired_workload.revision !== revision) return { ok: false, status: 409, reason: 'revision_not_authorized' };
    if (existing.health !== 'healthy' || existing.security_posture !== 'ready') return { ok: false, status: 409, reason: 'node_not_ready' };
    const deployed = normalizeNode({ ...existing, revision, state: 'ready', last_seen_at: now(), desired_workload: { ...existing.desired_workload, deployed_at: now() } });
    const saved = await store.upsert(deployed);
    if (!saved.ok) return { ok: false, status: 503, reason: saved.reason };
    await event(nodeId, 'deployment.verified', { revision }, input.correlation_id || null);
    return { ok: true, node: deployed, deployment_verified: true };
  }

  async function drain(headers, input = {}) {
    const principal = controlPrincipal(headers);
    if (!principal) return { ok: false, status: 401, reason: 'control_authentication_required' };
    const nodeId = text(input.node_id);
    if (!nodeId) return { ok: false, status: 400, reason: 'node_id_required' };
    const current = await store.read(nodeId);
    if (!current.ok) return { ok: false, status: 503, reason: current.reason };
    if (!current.node) return { ok: false, status: 404, reason: 'node_not_registered' };
    const gate = authorizeRequest({ principal, action: 'manage', resource: `service:node-control:${nodeId}`, sensitive: true });
    if (gate.decision !== 'allow') return { ok: false, status: gate.decision === 'review' ? 202 : 403, reason: `fortress_${gate.decision}`, gate };
    const drained = normalizeNode({ ...current.node, state: 'draining' });
    const saved = await store.upsert(drained);
    if (!saved.ok) return { ok: false, status: 503, reason: saved.reason };
    await event(nodeId, 'node.draining', {}, input.correlation_id || null);
    return { ok: true, node: drained, gate };
  }

  return {
    contract: { persistence: store?.contract?.persistence || 'unknown', controlAuthConfigured: Boolean(configuredControlToken), nodeAuthConfigured: Object.keys(configuredNodeTokens).length > 0 },
    register,
    heartbeat,
    authorizeWorkload,
    recordDeployment,
    drain,
    async listReady() { return store.listReady(); }
  };
}
