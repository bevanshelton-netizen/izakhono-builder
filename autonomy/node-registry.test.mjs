import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-node-registry-'));
const registryPath = path.join(tempDir, 'registry.json');
process.env.IZAKHONO_NODE_REGISTRY_PATH = registryPath;
process.env.IZAKHONO_NODE_STALE_MS = '1000';
process.env.IZAKHONO_NODE_MAX_FUTURE_SKEW_MS = '30000';

const { recordHeartbeat, listNodes, selectReadyNode } = await import('./node-registry.mjs?test=1');

const readiness = {
  nodeReachable: true,
  persistentStorageReady: true,
  containerRuntimeReady: true,
  monitoringOnline: true,
};

recordHeartbeat({
  nodeId: 'NODE-FRESH',
  status: 'healthy',
  timestamp: new Date(Date.now() - 100).toISOString(),
  checks: readiness,
  capacity: { loadAverage: [0.2] },
});

let fresh = listNodes().find((node) => node.nodeId === 'NODE-FRESH');
assert.equal(fresh.health, 'online');
assert.equal(fresh.freshnessReason, 'fresh-heartbeat');
assert.equal(selectReadyNode().nodeId, 'NODE-FRESH');

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
registry.nodes['NODE-EXPIRED'] = {
  nodeId: 'NODE-EXPIRED',
  status: 'healthy',
  receivedAt: new Date(Date.now() - 5000).toISOString(),
  readiness,
  capacity: { loadAverage: [0.01] },
  staleAfterMs: 1000,
};
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

const expired = listNodes().find((node) => node.nodeId === 'NODE-EXPIRED');
assert.equal(expired.health, 'stale');
assert.equal(expired.freshnessReason, 'heartbeat-expired');
assert.equal(selectReadyNode().nodeId, 'NODE-FRESH');

registry.nodes['NODE-FUTURE'] = {
  nodeId: 'NODE-FUTURE',
  status: 'healthy',
  receivedAt: new Date(Date.now() + 120000).toISOString(),
  readiness,
  capacity: { loadAverage: [0.01] },
  staleAfterMs: 1000,
};
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

const future = listNodes().find((node) => node.nodeId === 'NODE-FUTURE');
assert.equal(future.health, 'stale');
assert.equal(future.freshnessReason, 'receivedAt-in-future');

registry.nodes['NODE-BAD-TIME'] = {
  nodeId: 'NODE-BAD-TIME',
  status: 'healthy',
  receivedAt: 'not-a-timestamp',
  readiness,
};
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

const invalid = listNodes().find((node) => node.nodeId === 'NODE-BAD-TIME');
assert.equal(invalid.health, 'stale');
assert.equal(invalid.freshnessReason, 'missing-or-invalid-receivedAt');

console.log('NODE registry freshness tests passed.');
