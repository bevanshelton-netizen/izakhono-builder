import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpNavProvider } from '../nav-provider-http.mjs';

test('HTTP NAV provider requires TLS outside loopback', () => {
  assert.throws(() => createHttpNavProvider({ baseUrl: 'http://provider.example', token: 'test' }), /NAV_PROVIDER_HTTPS_REQUIRED/);
  assert.doesNotThrow(() => createHttpNavProvider({ baseUrl: 'http://127.0.0.1:9000', token: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }));
});

test('HTTP NAV provider uses fixed typed routes and bearer authorization', async () => {
  const observed = [];
  const provider = createHttpNavProvider({
    baseUrl: 'https://runtime-fabric.example',
    token: 'never-log-this-token',
    fetchImpl: async (url, init) => {
      observed.push({ url: String(url), init });
      return { ok: true, json: async () => ({ provider_ref: 'runtime-ref' }) };
    }
  });
  const result = await provider.provision({ workload_id: 'navwl_test', spec: { workload: 'izakhono-nav' } });
  assert.equal(result.provider_ref, 'runtime-ref');
  assert.equal(observed[0].url, 'https://runtime-fabric.example/v1/workloads/nav/provision');
  assert.equal(observed[0].init.headers.authorization, 'Bearer never-log-this-token');
  assert.equal(observed[0].init.headers['cache-control'], 'no-store');
  assert.equal(observed[0].init.method, 'POST');
});

test('HTTP NAV provider sanitizes provider failures', async () => {
  const provider = createHttpNavProvider({
    baseUrl: 'https://runtime-fabric.example',
    token: 'test',
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ message: 'sensitive provider detail' }) })
  });
  await assert.rejects(provider.inspect({ workload_id: 'navwl_test' }), error => {
    assert.equal(error.code, 'NAV_PROVIDER_403');
    assert.equal(error.statusCode, 502);
    assert.equal(error.message, 'NAV_PROVIDER_REQUEST_FAILED');
    return true;
  });
});
