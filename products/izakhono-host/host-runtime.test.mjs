import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(root, 'runtime/control-plane/server.mjs');
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'izakhono-host-runtime-'));
const port = 18081;
const token = 'ci-host-runtime-token';
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [serverPath], {
  cwd: root,
  env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST_RUNTIME_TOKEN: token, HOST_PUBLIC_IP: '' },
  stdio: 'ignore',
});

function getWithHost(hostname, requestPath = '/') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method: 'GET', headers: { Host: hostname } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks), text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) { ready = true; break; }
    } catch {}
    if (child.exitCode !== null) throw new Error(`host runtime exited with ${child.exitCode}`);
    await delay(150);
  }
  assert.ok(ready, 'host runtime should become healthy');

  const unauthorized = await fetch(`${base}/api/control-centre`);
  assert.equal(unauthorized.status, 401, 'control-centre endpoint must require owner token');

  const provision = await request(`${base}/api/sites/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: 'test.example.invalid', source_ref: 'ci' }),
  });
  assert.equal(provision.status, 201);
  const provisionData = await provision.json();
  const siteId = provisionData.site.id;
  assert.ok(siteId);

  const payload = {
    files: [
      { path: 'index.html', content_base64: Buffer.from('<h1>IZAKHONO CI SITE</h1>').toString('base64') },
      { path: 'assets/logo.png', content_base64: Buffer.from([0, 1, 2, 255]).toString('base64') },
    ],
  };
  const deployed = await request(`${base}/api/sites/${siteId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(deployed.status, 200);
  const deploymentData = await deployed.json();
  assert.equal(deploymentData.site.status, 'content_ready');
  assert.equal(deploymentData.deployment.status, 'deployed');

  const served = await getWithHost('test.example.invalid');
  assert.equal(served.status, 200);
  assert.match(served.text, /IZAKHONO CI SITE/);
  const asset = await getWithHost('test.example.invalid', '/assets/logo.png');
  assert.equal(asset.status, 200);
  assert.deepEqual([...asset.body], [0, 1, 2, 255], 'binary assets must survive base64 deployment intact');

  const blocked = await request(`${base}/api/sites/${siteId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: [{ path: '.env', content_base64: Buffer.from('SECRET=value').toString('base64') }] }),
  });
  assert.equal(blocked.status, 400, 'private environment files must be blocked');

  const dashboard = await request(`${base}/api/control-centre`);
  assert.equal(dashboard.status, 200);
  const snapshot = await dashboard.json();
  assert.equal(snapshot.summary.total_sites, 1);
  assert.equal(snapshot.summary.live_sites, 0);
  assert.equal(snapshot.summary.pending_acceptance, 1);

  console.log('[PASS] host runtime auth, provisioning, binary-safe atomic deployment, secret-path blocking and control-centre telemetry');
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(1500),
  ]);
  await rm(dataDir, { recursive: true, force: true });
}
