import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-node-test-'));
const registryPath = path.join(tempDir, 'node-registry.json');
const env = { ...process.env, IZAKHONO_NODE_REGISTRY_PATH: registryPath, IZAKHONO_NODE_STALE_MS: '180000' };

function run(operation, payload) {
  const result = spawnSync(process.execPath, ['autonomy/node-control-plane.mjs', operation, JSON.stringify(payload)], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const timestamp = new Date().toISOString();
run('heartbeat', {
  contract: 'izakhono.node-heartbeat/v1',
  node: { id: 'NODE01', hostname: 'node01' },
  health: 'healthy',
  timestamp,
  capacity: { loadAverage: [0.4, 0.5, 0.6] },
  checks: {
    nodeReachable: true,
    persistentStorageReady: true,
    containerRuntimeReady: true,
    monitoringOnline: true,
  },
});

const target = run('target', {});
assert.equal(target.status, 'ready');
assert.equal(target.nodeId, 'NODE01');

const status = run('status', {});
assert.equal(status.length, 1);
assert.equal(status[0].nodeId, 'NODE01');
assert.equal(status[0].health, 'online');

console.log(JSON.stringify({ status: 'passed', selectedNode: target.nodeId }));
fs.rmSync(tempDir, { recursive: true, force: true });
