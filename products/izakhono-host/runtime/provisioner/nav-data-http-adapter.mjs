import { createProviderHttpClient } from './provider-http-client.mjs';

const SOURCE_URL = 'https://download.geofabrik.de/africa/south-africa-latest.osm.pbf';

export function createHttpNavDataAdapter(config) {
  const client = createProviderHttpClient(config);
  const send = (stage, input, signal, extra = {}) => client.request('POST', '/v1/nav-data/' + stage, {
    workloadId: input.workloadId,
    releaseDigest: input.releaseDigest,
    sourceUrl: stage === 'osm-source' ? SOURCE_URL : undefined,
    priorEvidence: input.priorEvidence,
    ...extra
  }, signal);

  return Object.freeze({
    fetchSource: input => send('osm-source', input, input.signal),
    buildRoutingGraph: input => send('routing-graph', input, input.signal),
    importSearchIndex: input => send('search-index', input, input.signal),
    buildMapTiles: input => send('map-tiles', input, input.signal),
    inspectServices: input => send('service-acceptance', input, input.signal)
  });
}
