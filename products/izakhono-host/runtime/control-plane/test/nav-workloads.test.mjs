import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { createNavWorkloadController } from '../nav-workloads.mjs';

async function fixture(provider) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'nav-workloads-'));
  const controller = createNavWorkloadController({ dataDir, provider });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const handled = await controller.handle(req, res, url, async request => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    }, (response, status, value) => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(value));
    });
    if (!handled) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  return {
    base,
    close: async () => {
      await new Promise(resolve => server.close(resolve));
      await rm(dataDir, { recursive: true, force: true });
    }
  };
}

const validSpec = {
  release_id: 'nav-release-1',
  artifact_digest: 'sha256:' + 'a'.repeat(64),
  logical_runtime_id: 'NODE01',
  secret_ref: 'fortress://nav/production'
};

test('NAV workload lifecycle is typed, idempotent and evidence-gated', async () => {
  const calls = [];
  const provider = {
    async provision(input) { calls.push(['provision', input]); return { provider_ref: 'managed-runtime-1' }; },
    async inspect() { calls.push(['inspect']); return { ready: true, health: { engine: 'ready', routing: 'ready', search: 'ready', tiles: 'ready' } }; },
    async stop() { calls.push(['stop']); return {}; },
    async replace(input) { calls.push(['replace', input]); return {}; },
    async backup() { calls.push(['backup']); return { backup_ref: 'backup://nav/backup-1' }; },
    async restore(input) { calls.push(['restore', input]); return {}; }
  };
  const app = await fixture(provider);
  try {
    const create = await fetch(app.base + '/api/workloads/nav', {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'nav-ci-001' },
      body: JSON.stringify(validSpec)
    });
    assert.equal(create.status, 202);
    const created = await create.json();
    assert.equal(created.workload.status, 'provisioned');
    assert.equal(created.workload.logical_runtime_id, 'NODE01');
    assert.equal(created.workload.provider_ref, 'managed-runtime-1');
    assert.equal(created.workload.secret_ref, 'fortress://nav/production');
    assert.equal(JSON.stringify(created).includes('production-secret-value'), false);

    const replay = await fetch(app.base + '/api/workloads/nav', {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'nav-ci-001' },
      body: JSON.stringify(validSpec)
    });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).idempotent_replay, true);
    assert.equal(calls.filter(call => call[0] === 'provision').length, 1);

    const inspect = await fetch(app.base + '/api/workloads/nav/' + created.workload.id);
    assert.equal(inspect.status, 200);
    const inspected = await inspect.json();
    assert.equal(inspected.workload.status, 'ready');
    assert.deepEqual(inspected.workload.health, { engine: 'ready', routing: 'ready', search: 'ready', tiles: 'ready' });

    const backup = await fetch(app.base + '/api/workloads/nav/' + created.workload.id + '/backup', { method: 'POST' });
    assert.equal(backup.status, 200);
    assert.equal((await backup.json()).workload.last_backup_ref, 'backup://nav/backup-1');

    const restore = await fetch(app.base + '/api/workloads/nav/' + created.workload.id + '/restore', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ backup_ref: 'backup://nav/backup-1' })
    });
    assert.equal(restore.status, 200);

    const stop = await fetch(app.base + '/api/workloads/nav/' + created.workload.id + '/stop', { method: 'POST' });
    assert.equal(stop.status, 200);
    assert.equal((await stop.json()).workload.status, 'stopped');
    assert.deepEqual(calls.map(call => call[0]), ['provision', 'inspect', 'backup', 'restore', 'stop']);
  } finally { await app.close(); }
});

test('NAV workload refuses mutable artifacts and secret values', async () => {
  const app = await fixture({});
  try {
    const mutable = await fetch(app.base + '/api/workloads/nav', {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'nav-ci-002' },
      body: JSON.stringify({ ...validSpec, artifact_digest: 'latest' })
    });
    assert.equal(mutable.status, 400);
    assert.equal((await mutable.json()).error, 'IMMUTABLE_ARTIFACT_DIGEST_REQUIRED');

    const secretValue = await fetch(app.base + '/api/workloads/nav', {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'nav-ci-003' },
      body: JSON.stringify({ ...validSpec, secret_ref: 'super-secret-password' })
    });
    assert.equal(secretValue.status, 400);
    assert.equal((await secretValue.json()).error, 'SECRET_REFERENCE_REQUIRED_NOT_SECRET_VALUE');
  } finally { await app.close(); }
});

test('NAV workload fails closed without an approved runtime provider', async () => {
  const app = await fixture(null);
  try {
    const response = await fetch(app.base + '/api/workloads/nav', {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'nav-ci-004' },
      body: JSON.stringify(validSpec)
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'NAV_RUNTIME_PROVIDER_UNAVAILABLE');
  } finally { await app.close(); }
});
