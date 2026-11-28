import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderHttpClient } from './provider-http-client.mjs';

test('provider transport requires HTTPS except loopback development', () => {
  assert.throws(() => createProviderHttpClient({ baseUrl: 'http://provider.example', token: 'test' }), /PROVIDER_HTTPS_REQUIRED/);
  assert.throws(() => createProviderHttpClient({ baseUrl: 'https://user:pass@provider.example', token: 'test' }), /PROVIDER_BASE_URL_INVALID/);
  assert.throws(() => createProviderHttpClient({ baseUrl: 'https://provider.example/path', token: 'test' }), /PROVIDER_BASE_URL_INVALID/);
  assert.doesNotThrow(() => createProviderHttpClient({ baseUrl: 'http://127.0.0.1:8080', token: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }));
});

test('provider transport sanitizes errors and does not expose response bodies', async () => {
  const client = createProviderHttpClient({
    baseUrl: 'https://provider.example', token: 'secret',
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ detail: 'sensitive account information' }) })
  });
  await assert.rejects(client.request('GET', '/v1/health'), error => {
    assert.equal(error.code, 'PROVIDER_HTTP_403');
    assert.equal(error.message, 'PROVIDER_HTTP_REQUEST_FAILED');
    assert.equal(error.statusCode, 502);
    return true;
  });
});
