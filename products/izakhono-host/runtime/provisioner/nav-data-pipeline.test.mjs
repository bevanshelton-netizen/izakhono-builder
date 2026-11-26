import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_DATA_PIPELINE_STAGES,
  createNavDataPipelineRecord,
  recordNavDataStage,
  assertNavDataReady
} from './nav-data-pipeline.mjs';

const digest = 'a'.repeat(64);
const source = {
  sourceUrl: 'https://download.geofabrik.de/africa/south-africa-latest.osm.pbf',
  artifactPath: 'osm/south-africa-latest.osm.pbf',
  checksumAlgorithm: 'md5',
  checksum: 'b'.repeat(32),
  bytes: 1024
};
const routing = { artifactPath: 'router/valhalla-tiles.tar', buildId: 'valhalla-build-001', healthCheck: true };
const search = { artifactPath: 'search/nominatim-db', importId: 'nominatim-import-001', healthCheck: true };
const tiles = { artifactPath: 'tiles/south-africa.pmtiles', checksumAlgorithm: 'sha256', checksum: 'c'.repeat(64), tileCount: 5000 };
const services = {
  'nav-router': { healthy: true },
  'nav-search': { healthy: true },
  'nav-tiles': { healthy: true },
  'nav-engine': { healthy: true },
  'nav-web': { healthy: true }
};
const accepted = { releaseDigest: digest, services };

function completeImports(record) {
  record = recordNavDataStage(record, 'osm-source', source);
  record = recordNavDataStage(record, 'routing-graph', routing);
  record = recordNavDataStage(record, 'search-index', search);
  record = recordNavDataStage(record, 'map-tiles', tiles);
  return record;
}

test('defines the South Africa source, routing, search, tiles and service gates', () => {
  assert.deepEqual(NAV_DATA_PIPELINE_STAGES.map(stage => stage.id), [
    'osm-source', 'routing-graph', 'search-index', 'map-tiles', 'service-acceptance'
  ]);
});

test('requires source verification before routing, search or tile imports', () => {
  const record = createNavDataPipelineRecord({ workloadId: 'izakhono-nav', releaseDigest: digest });
  assert.throws(() => recordNavDataStage(record, 'routing-graph', routing), /requires completed dependency: osm-source/);
  assert.throws(() => recordNavDataStage(record, 'search-index', search), /requires completed dependency: osm-source/);
  assert.throws(() => recordNavDataStage(record, 'map-tiles', tiles), /requires completed dependency: osm-source/);
});

test('requires Geofabrik MD5 source evidence and PMTiles SHA-256 evidence', () => {
  const record = createNavDataPipelineRecord({ workloadId: 'izakhono-nav', releaseDigest: digest });
  assert.throws(() => recordNavDataStage(record, 'osm-source', { ...source, checksumAlgorithm: 'sha256' }), /Geofabrik MD5/);
  const withSource = recordNavDataStage(record, 'osm-source', source);
  assert.throws(() => recordNavDataStage(withSource, 'map-tiles', { ...tiles, checksumAlgorithm: 'md5' }), /PMTiles archive must include a SHA-256/);
});

test('does not accept service readiness until all imported artifacts exist', () => {
  const record = completeImports(createNavDataPipelineRecord({ workloadId: 'izakhono-nav', releaseDigest: digest }));
  assert.throws(() => recordNavDataStage(record, 'service-acceptance', { ...accepted, services: { ...services, 'nav-search': { healthy: false } } }), /nav-search/);
  assert.throws(() => recordNavDataStage(record, 'service-acceptance', { ...accepted, releaseDigest: 'd'.repeat(64) }), /does not match/);
  const ready = recordNavDataStage(record, 'service-acceptance', accepted);
  assert.equal(ready.state, 'VERIFYING');
  assert.equal(assertNavDataReady(ready), true);
});

test('records immutable evidence and rejects duplicate stage completion', () => {
  const record = createNavDataPipelineRecord({ workloadId: 'izakhono-nav', releaseDigest: digest });
  const updated = recordNavDataStage(record, 'osm-source', source);
  assert.notEqual(updated.stages['osm-source'].evidence, source);
  assert.throws(() => recordNavDataStage(updated, 'osm-source', source), /already completed/);
  assert.throws(() => assertNavDataReady(updated), /not ready/);
});

test('rejects unapproved OSM origins and unsafe artifact paths', () => {
  const record = createNavDataPipelineRecord({ workloadId: 'izakhono-nav', releaseDigest: digest });
  assert.throws(() => recordNavDataStage(record, 'osm-source', {
    ...source, sourceUrl: 'http://download.geofabrik.de/africa/south-africa-latest.osm.pbf'
  }), /official Geofabrik/);
  assert.throws(() => recordNavDataStage(record, 'osm-source', {
    ...source, sourceUrl: 'https://example.com/africa/south-africa-latest.osm.pbf'
  }), /official Geofabrik/);
  assert.throws(() => recordNavDataStage(record, 'osm-source', {
    ...source, artifactPath: '../outside/sa.osm.pbf'
  }), /safe relative path/);
  const withSource = recordNavDataStage(record, 'osm-source', source);
  assert.throws(() => recordNavDataStage(withSource, 'routing-graph', {
    ...routing, artifactPath: '/etc/passwd'
  }), /safe relative path/);
});
