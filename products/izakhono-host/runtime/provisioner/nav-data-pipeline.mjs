/**
 * Provider-neutral NAV South Africa data pipeline contract.
 *
 * This module validates job ordering and independently verifiable evidence.
 * It does not download data, invoke containers, or claim that imports ran.
 */
export const NAV_DATA_PIPELINE_STAGES = Object.freeze([
  Object.freeze({
    id: 'osm-source',
    dependsOn: [],
    evidence: Object.freeze(['sourceUrl', 'artifactPath', 'checksumAlgorithm', 'checksum', 'bytes'])
  }),
  Object.freeze({
    id: 'routing-graph',
    dependsOn: ['osm-source'],
    evidence: Object.freeze(['artifactPath', 'buildId', 'healthCheck'])
  }),
  Object.freeze({
    id: 'search-index',
    dependsOn: ['osm-source'],
    evidence: Object.freeze(['artifactPath', 'importId', 'healthCheck'])
  }),
  Object.freeze({
    id: 'map-tiles',
    dependsOn: ['osm-source'],
    evidence: Object.freeze(['artifactPath', 'checksumAlgorithm', 'checksum', 'tileCount'])
  }),
  Object.freeze({
    id: 'service-acceptance',
    dependsOn: ['routing-graph', 'search-index', 'map-tiles'],
    evidence: Object.freeze(['releaseDigest', 'services'])
  })
]);

const STAGE_BY_ID = new Map(NAV_DATA_PIPELINE_STAGES.map(stage => [stage.id, stage]));
const MD5 = /^[a-f0-9]{32}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const REQUIRED_SERVICES = Object.freeze(['nav-router', 'nav-search', 'nav-tiles', 'nav-engine', 'nav-web']);

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
}

function requireSafeArtifactPath(value) {
  requireText(value, 'artifactPath');
  if (value.startsWith('/') ||
      value.split('/').some(part => !part || part === '.' || part === '..') ||
      !/^[A-Za-z0-9._/-]{1,512}$/.test(value)) {
    throw new Error('artifactPath must be a safe relative path without traversal segments');
  }
}

function requireApprovedOsmSource(value) {
  requireText(value, 'sourceUrl');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('sourceUrl must be a valid HTTPS URL'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'download.geofabrik.de' ||
      parsed.pathname !== '/africa/south-africa-latest.osm.pbf' || parsed.search || parsed.hash) {
    throw new Error('sourceUrl must identify the official Geofabrik South Africa OSM PBF extract');
  }
}

export function createNavDataPipelineRecord({ workloadId, releaseDigest, now = new Date().toISOString() } = {}) {
  requireText(workloadId, 'workloadId');
  if (typeof releaseDigest !== 'string' || !SHA256.test(releaseDigest)) {
    throw new Error('releaseDigest must be a SHA-256 digest');
  }
  return {
    workloadId,
    releaseDigest: releaseDigest.toLowerCase(),
    state: 'IMPORTING_DATA',
    createdAt: now,
    updatedAt: now,
    stages: Object.fromEntries(NAV_DATA_PIPELINE_STAGES.map(stage => [stage.id, {
      status: 'pending',
      evidence: null,
      completedAt: null
    }]))
  };
}

export function recordNavDataStage(record, stageId, evidence, now = new Date().toISOString()) {
  const stage = STAGE_BY_ID.get(stageId);
  if (!stage) throw new Error(`Unknown NAV data pipeline stage: ${stageId}`);
  if (!record || record.state !== 'IMPORTING_DATA') throw new Error('NAV data pipeline is not accepting stage results');
  if (record.stages?.[stageId]?.status === 'succeeded') throw new Error(`NAV data stage already completed: ${stageId}`);

  for (const dependency of stage.dependsOn) {
    if (record.stages?.[dependency]?.status !== 'succeeded') {
      throw new Error(`NAV data stage ${stageId} requires completed dependency: ${dependency}`);
    }
  }
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error(`Evidence object is required for NAV data stage: ${stageId}`);
  }
  for (const key of stage.evidence) {
    if (!(key in evidence) || evidence[key] === null || evidence[key] === undefined || evidence[key] === '') {
      throw new Error(`NAV data stage ${stageId} is missing evidence: ${key}`);
    }
  }

  if (stageId === 'osm-source') {
    requireApprovedOsmSource(evidence.sourceUrl);
    requireSafeArtifactPath(evidence.artifactPath);
    if (evidence.checksumAlgorithm !== 'md5' || !MD5.test(String(evidence.checksum))) {
      throw new Error('South Africa OSM source must include the verified Geofabrik MD5 checksum');
    }
    if (!Number.isSafeInteger(evidence.bytes) || evidence.bytes <= 0) throw new Error('OSM source bytes must be a positive safe integer');
  }
  if (stageId === 'routing-graph' || stageId === 'search-index') {
    requireSafeArtifactPath(evidence.artifactPath);
    requireText(evidence.buildId || evidence.importId, 'buildId/importId');
    if (evidence.healthCheck !== true) throw new Error(`${stageId} healthCheck must be true`);
  }
  if (stageId === 'map-tiles') {
    requireSafeArtifactPath(evidence.artifactPath);
    if (evidence.checksumAlgorithm !== 'sha256' || !SHA256.test(String(evidence.checksum))) {
      throw new Error('South Africa PMTiles archive must include a SHA-256 checksum');
    }
    if (!Number.isSafeInteger(evidence.tileCount) || evidence.tileCount <= 0) throw new Error('tileCount must be a positive safe integer');
  }
  if (stageId === 'service-acceptance') {
    if (String(evidence.releaseDigest).toLowerCase() !== record.releaseDigest) {
      throw new Error('Service acceptance releaseDigest does not match the requested immutable release');
    }
    if (!evidence.services || typeof evidence.services !== 'object' || Array.isArray(evidence.services)) {
      throw new Error('Service acceptance requires per-service health evidence');
    }
    const unhealthy = REQUIRED_SERVICES.filter(name => evidence.services[name]?.healthy !== true);
    if (unhealthy.length) throw new Error(`Service acceptance failed: ${unhealthy.join(', ')}`);
  }

  const stages = {
    ...record.stages,
    [stageId]: { status: 'succeeded', evidence: structuredClone(evidence), completedAt: now }
  };
  const allComplete = NAV_DATA_PIPELINE_STAGES.every(item => stages[item.id]?.status === 'succeeded');
  return {
    ...record,
    stages,
    state: allComplete ? 'VERIFYING' : 'IMPORTING_DATA',
    updatedAt: now,
    dataReadyAt: allComplete ? now : null
  };
}

export function assertNavDataReady(record) {
  const missing = NAV_DATA_PIPELINE_STAGES
    .filter(stage => record?.stages?.[stage.id]?.status !== 'succeeded')
    .map(stage => stage.id);
  if (record?.state !== 'VERIFYING' || missing.length) {
    throw new Error(`NAV data pipeline is not ready; missing: ${missing.join(', ')}`);
  }
  return true;
}
