import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-software-node-'));
const env = {
  ...process.env,
  IZAKHONO_NODE_STORAGE_PATH: path.join(tempDir, 'node-data'),
  IZAKHONO_NODE_ID: 'test-software-node',
  IZAKHONO_NODE_AUTH: '',
  IZAKHONO_BACKUP_TESTED: 'false',
  IZAKHONO_SECURITY_GATE: 'pending',
  IZAKHONO_MONITORING: 'offline',
};

function run(operation) {
  const result = spawnSync(process.execPath, ['autonomy/software-node.mjs', JSON.stringify({ operation })], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

try {
  const created = run('instantiate');
  assert.equal(created.nodeId, 'test-software-node');
  assert.equal(created.identityType, 'software-runtime');
  assert.equal(created.runtimeHostIsSeparate, true);

  const beat = run('heartbeat');
  assert.equal(beat.health, 'degraded');
  assert.equal(beat.checks.nodeReachable, true);
  assert.equal(beat.checks.nodeAuthenticated, false);
  assert.equal(beat.checks.backupTested, false);
  assert.equal(beat.checks.securityGatePassed, false);
  assert.equal(beat.checks.monitoringOnline, false);

  const promoted = run('promote');
  assert.equal(promoted.status, 'waiting');
  assert.equal(promoted.reason, 'required-evidence-missing');
  for (const gate of ['nodeAuthenticated', 'backupTested', 'securityGatePassed', 'monitoringOnline']) {
    assert.ok(promoted.missing.includes(gate), `expected missing gate: ${gate}`);
  }
  assert.ok(!JSON.stringify(promoted).includes('test-token'), 'secret values must not be emitted');
  console.log('[PASS] Software NODE cannot become eligible without authentication, backup, FORTRESS and monitoring evidence.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
