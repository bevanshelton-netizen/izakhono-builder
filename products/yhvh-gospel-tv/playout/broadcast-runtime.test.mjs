import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { YhvhBroadcastRuntime } from './broadcast-runtime.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yhvh-broadcast-'));
  const vaultDir = path.join(root, 'vault');
  const hlsDir = path.join(root, 'hls');
  const rightsManifestPath = path.join(root, 'broadcast-inputs.json');
  fs.mkdirSync(vaultDir, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtime = new YhvhBroadcastRuntime({ vaultDir, hlsDir, rightsManifestPath, territory: 'ZA', autoRestart: true });
  return { root, vaultDir, runtime, rightsManifestPath };
}

function writeManifest(file, items) {
  fs.writeFileSync(file, JSON.stringify({ schema: 'test', items }, null, 2));
}

function clearedItem(filePath) {
  return {
    id: 'TEST-001',
    title: 'Test Gospel Programme',
    path: filePath,
    status: 'READY',
    rightsStatus: 'CLEAR',
    qcStatus: 'PASS',
    territories: ['ZA']
  };
}

test('accepts a regular media file only after rights, QC and territory gates pass', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.vaultDir, 'service.mp4'), 'test media');
  writeManifest(f.rightsManifestPath, [clearedItem('service.mp4')]);
  const [item] = f.runtime.inspectInputs();
  assert.equal(item.eligible, true);
  assert.equal(item.fileExists, true);
  assert.deepEqual(item.blockedReasons, []);
});

test('blocks media symlinks that resolve outside the content vault', (t) => {
  const f = fixture(t);
  const outside = path.join(f.root, 'outside.mp4');
  fs.writeFileSync(outside, 'private media');
  fs.symlinkSync(outside, path.join(f.vaultDir, 'linked.mp4'));
  writeManifest(f.rightsManifestPath, [clearedItem('linked.mp4')]);
  const [item] = f.runtime.inspectInputs();
  assert.equal(item.eligible, false);
  assert.equal(item.fileExists, false);
  assert.ok(item.blockedReasons.includes('path_outside_vault'));
});

test('blocks directory paths even when they have a video extension', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.vaultDir, 'folder.mp4'));
  writeManifest(f.rightsManifestPath, [clearedItem('folder.mp4')]);
  const [item] = f.runtime.inspectInputs();
  assert.equal(item.eligible, false);
  assert.equal(item.fileExists, false);
  assert.ok(item.blockedReasons.includes('media_missing'));
});

test('blocks uncleared media regardless of physical presence', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.vaultDir, 'service.mp4'), 'test media');
  const item = { ...clearedItem('service.mp4'), rightsStatus: 'REVIEW_REQUIRED' };
  writeManifest(f.rightsManifestPath, [item]);
  const [result] = f.runtime.inspectInputs();
  assert.equal(result.eligible, false);
  assert.ok(result.blockedReasons.includes('rights_not_clear'));
});

test('refuses an empty broadcast unless an explicit standby slate is enabled', (t) => {
  const f = fixture(t);
  writeManifest(f.rightsManifestPath, []);
  assert.throws(() => f.runtime.command([]), /broadcast_blocked_no_cleared_qc_content/);
  const standby = new YhvhBroadcastRuntime({
    vaultDir: f.vaultDir,
    hlsDir: f.hlsDir,
    rightsManifestPath: f.rightsManifestPath,
    territory: 'ZA',
    standbySlate: true
  });
  assert.equal(standby.command([]).mode, 'STANDBY_SLATE');
});
