import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-node01-'));
const script = fileURLToPath(new URL('./software-node.mjs', import.meta.url));
const env = { ...process.env, IZAKHONO_NODE_STORAGE_PATH: root, IZAKHONO_NODE_ID: 'NODE01' };

function run(operation) {
  const result = spawnSync(process.execPath, [script, JSON.stringify({ operation })], {
    encoding: 'utf8',
    env,
  });
  assert.equal(result.status, 0, result.stderr || `NODE01 ${operation} exited unsuccessfully`);
  return JSON.parse(result.stdout);
}

try {
  const instantiated = run('instantiate');
  assert.equal(instantiated.nodeId, 'NODE01');
  assert.equal(instantiated.status, 'instantiated');
  assert.equal(instantiated.contract, 'izakhono.software-node/v1');

  const heartbeat = run('heartbeat');
  assert.equal(heartbeat.nodeId, 'NODE01');
  assert.equal(heartbeat.health, 'healthy');
  assert.equal(heartbeat.checks.persistentStorageReady, true);

  const promoted = run('promote');
  assert.equal(promoted.nodeId, 'NODE01');
  assert.equal(promoted.status, 'eligible');
  assert.equal(promoted.heartbeat.health, 'healthy');

  const inspected = run('inspect');
  assert.equal(inspected.state.nodeId, 'NODE01');
  assert.equal(inspected.state.status, 'eligible');
  assert.equal(inspected.heartbeat.nodeId, 'NODE01');

  console.log('NODE01 software-node lifecycle tests passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
