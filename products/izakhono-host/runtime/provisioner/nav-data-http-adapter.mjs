import { createProviderHttpClient } from './provider-http-client.mjs';

const SOURCE_URL = 'https://download.geofabrik.de/africa/south-africa-latest.osm.pbf';
const STAGES = new Set(['osm-source', 'routing-graph', 'search-index', 'map-tiles', 'service-acceptance']);
const OPERATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function createHttpNavDataAdapter(config) {
  const client = createProviderHttpClient(config);
  async function startStage(input) {
    const stageId = String(input.stageId || '');
    if (!STAGES.has(stageId)) throw new Error('NAV_DATA_STAGE_INVALID');
    const operation = await client.request('POST', '/v1/nav-data/' + stageId, {
      workloadId: input.workloadId,
      releaseDigest: input.releaseDigest,
      sourceUrl: stageId === 'osm-source' ? SOURCE_URL : undefined,
      priorEvidence: input.priorEvidence,
      idempotencyKey: ['izakhono-nav', input.workloadId, input.releaseDigest, stageId].join(':')
    }, input.signal);
    return operation;
  }
  async function pollStage(input) {
    if (typeof input.operationId !== 'string' || !OPERATION_ID.test(input.operationId)) throw new Error('NAV_DATA_OPERATION_ID_INVALID');
    return client.request('GET', '/v1/nav-data/operations/' + encodeURIComponent(input.operationId), undefined, input.signal);
  }
  const direct = stageId => input => startStage({ ...input, stageId });
  return Object.freeze({
    startStage,
    pollStage,
    fetchSource: direct('osm-source'),
    buildRoutingGraph: direct('routing-graph'),
    importSearchIndex: direct('search-index'),
    buildMapTiles: direct('map-tiles'),
    inspectServices: direct('service-acceptance')
  });
}
