import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpRuntimeAdapter } from './http-runtime-adapter.mjs';

test('runtime adapter resolves only explicitly approved logical HOST targets', async () => {
  const calls = [];
  const adapter = createHttpRuntimeAdapter({
    baseUrl: 'https://runtime-fabric.example',
    token: 'provider-test-token',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return { ok: true, json: async () => ({ runtimeTargetId: 'nav-target-a', approved: true, enabled: true, providerTargetRef: 'opaque-target-ref' }) };
    }
  });
  const target = await adapter.resolveTarget({ runtimeTargetId: 'nav-target-a' });
  assert.deepEqual(target, { id: 'nav-target-a', providerTargetRef: 'opaque-target-ref' });
  assert.equal(calls[0].url, 'https://runtime-fabric.example/v1/runtime-targets/nav-target-a');
  assert.equal(calls[0].init.headers.authorization, 'Bearer provider-test-token');
  assert.equal(calls[0].init.headers['cache-control'], 'no-store');
});

test('runtime adapter fails closed for unapproved targets and invalid resource identifiers', async () => {
  const adapter = createHttpRuntimeAdapter({
    baseUrl: 'https://runtime-fabric.example', token: 'test',
    fetchImpl: async () => ({ ok: true, json: async () => ({ runtimeTargetId: 'other-target', approved: false, enabled: true }) })
  });
  assert.equal(await adapter.resolveTarget({ runtimeTargetId: 'nav-target-a' }), null);
  await assert.rejects(adapter.inspect({ target: { id: 'nav-target-a' }, resource: { id: '../escape' } }), /RUNTIME_RESOURCE_ID_INVALID/);
});

test('runtime adapter deploys and inspects the requested immutable digest', async () => {
  const calls = [];
  const adapter = createHttpRuntimeAdapter({
    baseUrl: 'https://runtime-fabric.example', token: 'test',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return { ok: true, json: async () => ({ healthy: true, releaseDigest: 'a'.repeat(64) }) };
    }
  });
  const target = { id: 'nav-target-a', providerTargetRef: 'opaque-target-ref' };
  const resource = { id: 'resource-001' };
  await adapter.deploy({ target, resource, releaseDigest: 'a'.repeat(64), workload: { workload_id: 'izakhono-nav' } });
  const observed = await adapter.inspect({ target, resource });
  assert.equal(observed.healthy, true);
  assert.equal(observed.releaseDigest, 'a'.repeat(64));
  assert.match(calls[0].url, /\/release$/);
  assert.equal(JSON.parse(calls[0].init.body).releaseDigest, 'a'.repeat(64));
});
