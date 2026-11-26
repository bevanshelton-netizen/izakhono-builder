import test from 'node:test';
import assert from 'node:assert/strict';
import { createHttpNavDataAdapter } from './nav-data-http-adapter.mjs';

test('data adapter exposes only the five fixed NAV pipeline stages', async () => {
  const calls = [];
  const adapter = createHttpNavDataAdapter({
    baseUrl: 'https://runtime-fabric.example',
    token: 'nav-data-token',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return { ok: true, json: async () => ({ ok: true }) };
    }
  });
  const input = { workloadId: 'izakhono-nav', releaseDigest: 'b'.repeat(64), priorEvidence: {}, signal: new AbortController().signal };
  await adapter.fetchSource(input);
  await adapter.buildRoutingGraph(input);
  await adapter.importSearchIndex(input);
  await adapter.buildMapTiles(input);
  await adapter.inspectServices(input);
  assert.deepEqual(calls.map(call => new URL(call.url).pathname), [
    '/v1/nav-data/osm-source',
    '/v1/nav-data/routing-graph',
    '/v1/nav-data/search-index',
    '/v1/nav-data/map-tiles',
    '/v1/nav-data/service-acceptance'
  ]);
  const source = JSON.parse(calls[0].init.body);
  assert.equal(source.sourceUrl, 'https://download.geofabrik.de/africa/south-africa-latest.osm.pbf');
  assert.equal(calls[0].init.headers.authorization, 'Bearer nav-data-token');
  assert.match(JSON.parse(calls[0].init.body).idempotencyKey, /^izakhono-nav:izakhono-nav:/);
});

test('data adapter resumes long-running imports through operation polling', async () => {
  const calls = [];
  const adapter = createHttpNavDataAdapter({
    baseUrl: 'https://runtime-fabric.example',
    token: 'nav-data-token',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return { ok: true, json: async () => ({ status: 'running', operationId: 'op-nav-import-001' }) };
    }
  });
  const input = { stageId: 'search-index', workloadId: 'izakhono-nav', releaseDigest: 'b'.repeat(64), priorEvidence: {}, signal: new AbortController().signal };
  const started = await adapter.startStage(input);
  assert.equal(started.status, 'running');
  const polled = await adapter.pollStage({ ...input, operationId: started.operationId });
  assert.equal(polled.operationId, 'op-nav-import-001');
  assert.equal(calls[0].url, 'https://runtime-fabric.example/v1/nav-data/search-index');
  assert.equal(calls[1].url, 'https://runtime-fabric.example/v1/nav-data/operations/op-nav-import-001');
  assert.equal(calls[1].init.method, 'GET');
});
});
