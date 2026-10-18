import assert from 'node:assert/strict';
import { createPersistentNodeControl } from './services/persistent-node-control.mjs';

function fakeStore() {
  const nodes = new Map();
  const events = [];
  return {
    contract: { persistence: 'supabase' },
    async read(id) { return { ok: true, node: nodes.get(id) || null }; },
    async listReady() { return { ok: true, nodes: [...nodes.values()].filter(n => n.state === 'ready' && n.health === 'healthy' && n.security_posture === 'ready') }; },
    async upsert(node) { nodes.set(node.node_id, structuredClone(node)); return { ok: true, node }; },
    async appendEvent(event) { events.push(event); return { ok: true }; },
    events,
    nodes
  };
}

const store = fakeStore();
const controlToken = 'control-secret';
const nodeToken = 'node-secret';
const api = createPersistentNodeControl({ store, controlToken, nodeTokens: JSON.stringify({ 'node-01': nodeToken }) });
const controlHeaders = { authorization: `Bearer ${controlToken}` };
const nodeHeaders = { authorization: `Bearer ${nodeToken}` };

let result = await api.register(controlHeaders, { node: { node_id:'node-01', environment:'production', capabilities:['one'], runtime_version:'1.0', health:'healthy', security_posture:'ready' } });
assert.equal(result.ok, true);
assert.equal(result.node.state, 'registered');

result = await api.heartbeat(nodeHeaders, { node_id:'node-01', health:'healthy', revision:'abc123' });
assert.equal(result.ok, true);
assert.equal(result.node.state, 'ready');

result = await api.authorizeWorkload(controlHeaders, { node_id:'node-01', revision:'def456', correlation_id:'corr-1' });
assert.equal(result.ok, true);
assert.equal(result.node.desired_workload.revision, 'def456');

result = await api.recordDeployment(controlHeaders, { node_id:'node-01', revision:'wrong' });
assert.equal(result.ok, false);
assert.equal(result.reason, 'revision_not_authorized');

result = await api.recordDeployment(controlHeaders, { node_id:'node-01', revision:'def456', correlation_id:'corr-2' });
assert.equal(result.ok, true);
assert.equal(result.deployment_verified, true);

result = await api.listReady();
assert.equal(result.ok, true);
assert.equal(result.nodes.length, 1);

result = await api.drain(controlHeaders, { node_id:'node-01', correlation_id:'corr-3' });
assert.equal(result.ok, true);
assert.equal(result.node.state, 'draining');

result = await api.listReady();
assert.equal(result.nodes.length, 0);

result = await api.register({}, { node: { node_id:'node-02' } });
assert.equal(result.ok, false);
assert.equal(result.status, 401);

result = await api.heartbeat({}, { node_id:'node-01', health:'healthy' });
assert.equal(result.ok, false);
assert.equal(result.status, 401);

assert.ok(store.events.some(event => event.event_type === 'deployment.verified'));
console.log('PERSISTENT_NODE_CONTROL_TEST=PASS');
