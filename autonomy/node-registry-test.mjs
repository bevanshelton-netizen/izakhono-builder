import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-registry-'));
process.env.IZAKHONO_NODE_REGISTRY_PATH = path.join(dir, 'registry.json');
const { recordHeartbeat, listNodes, getNode } = await import('./node-registry.mjs');

const node = recordHeartbeat({
  nodeId: 'TEST-NODE-01',
  timestamp: new Date().toISOString(),
  status: 'healthy',
  capacity: { cpuCount: 4, memoryBytes: 1024 },
  readiness: { containerRuntime: true },
});

assert.equal(node.nodeId, 'TEST-NODE-01');
assert.equal(listNodes()[0].health, 'online');
assert.equal(getNode('TEST-NODE-01').status, 'healthy');
assert.equal(getNode('MISSING'), null);

console.log('node-registry-test: PASS');
