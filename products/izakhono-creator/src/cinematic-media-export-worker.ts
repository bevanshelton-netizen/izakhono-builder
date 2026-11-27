import {
  getRunnableTasks,
  recordMediaQaEvidence,
  updateTaskWithEvidence,
  type CinematicProduction,
  type ProductionAsset,
} from './cinematic-production-graph';
import { exportAndStore, type MediaExportRequest, type MediaExportResult, type MediaExportRuntime } from './media-export-executor';

export type DistributionExportStore = {
  put(key: string, bytes: Uint8Array, metadata: { contentType: string; sha256: string }): Promise<void>;
};
export type ProductionExportRequest = {
  masterAssetId: string;
  exportTaskId: string;
  outputAssetId: string;
  outputPath: string;
  objectKey: string;
  recordedBy: string;
};
export type ProductionExportResult = {
  production: CinematicProduction;
  asset: ProductionAsset;
  export: MediaExportResult;
};

/**
 * Runs a Facebook delivery export against a graph-approved master asset.
 * The caller resolves the canonical master storage key to a worker-local path;
 * this module verifies the bytes against the graph hash before invoking FFmpeg.
 * Passing exports are stored before graph completion; failed QA is retained as
 * a failed asset with its hash-bound evidence and never stored as a deliverable.
 */
export async function executeProductionDistributionExport(
  project: CinematicProduction,
  request: ProductionExportRequest,
  runtime: MediaExportRuntime,
  store: DistributionExportStore,
  resolveStoredAsset: (storageKey: string) => Promise<string>,
  now: () => string = () => new Date().toISOString(),
): Promise<ProductionExportResult> {
  const master = project.assets.find(asset => asset.id === request.masterAssetId);
  if (!master || master.kind !== 'video' || master.role !== 'master' || master.status !== 'completed' || !master.storageKey?.trim()) {
    throw new Error('A completed, stored master video asset is required.');
  }
  if (!master.provenance.licence?.trim()) throw new Error('The approved master must carry recorded licence evidence.');
  if (!master.contentHash || !/^[a-f0-9]{64}$/i.test(master.contentHash)) {
    throw new Error('The approved master must have a SHA-256 content hash.');
  }
  const masterApproval = project.approvals.find(item => item.gate === 'master');
  if (masterApproval?.status !== 'approved' || !masterApproval.approverId?.trim() || !masterApproval.decidedAt || !Number.isFinite(Date.parse(masterApproval.decidedAt))) {
    throw new Error('An auditable master approval is required before distribution export.');
  }
  const task = project.tasks.find(item => item.id === request.exportTaskId);
  if (!task || task.kind !== 'export') throw new Error('A valid export task is required.');
  if (!task.inputAssetIds.includes(master.id)) throw new Error('The selected master asset must be declared as an input to this export task.');
  if (!getRunnableTasks(project).some(item => item.id === task.id)) throw new Error('The export task is not runnable; complete its dependencies first.');
  if (!request.outputAssetId.trim() || !request.outputPath.trim() || !request.objectKey.trim() || !request.recordedBy.trim()) {
    throw new Error('Output asset ID, worker path, storage key and worker identity are required.');
  }
  const allowedObjectKeyPrefix = `projects/${encodeURIComponent(project.id)}/exports/`;
  if (!request.objectKey.startsWith(allowedObjectKeyPrefix) || request.objectKey.includes('..') || request.objectKey.includes('\\\\')) {
    throw new Error('Distribution export storage key must remain inside this project’s exports namespace.');
  }
  if (project.assets.some(asset => asset.id === request.outputAssetId)) throw new Error('Distribution export asset ID already exists.');
  if (project.assets.some(asset => asset.storageKey === request.objectKey)) throw new Error('Distribution export storage key already exists.');

  const sourcePath = await resolveStoredAsset(master.storageKey);
  if (!sourcePath.trim()) throw new Error('The master asset resolver returned an empty worker path.');
  const sourceBytes = await runtime.readFile(sourcePath);
  const sourceHash = await runtime.sha256(sourceBytes);
  if (sourceHash.toLowerCase() !== master.contentHash.toLowerCase()) {
    throw new Error('Resolved master bytes do not match the approved master SHA-256; refusing export.');
  }

  const exportRequest: MediaExportRequest = {
    sourcePath,
    outputPath: request.outputPath,
    recordedBy: request.recordedBy,
  };
  const result = await exportAndStore(exportRequest, runtime, store, request.objectKey, now);
  const asset: ProductionAsset = {
    id: request.outputAssetId,
    kind: 'video',
    status: result.status === 'qa_passed' ? 'completed' : 'failed',
    source: 'assembled',
    role: 'distribution_export',
    storageKey: result.status === 'qa_passed' ? request.objectKey : undefined,
    contentHash: result.contentHash,
    mimeType: 'video/mp4',
    parentAssetIds: [master.id],
    provenance: {
      createdAt: result.mediaQa.recordedAt,
      licence: master.provenance.licence,
      consentRecordIds: [...master.provenance.consentRecordIds],
    },
    mediaQa: result.mediaQa,
  };
  let updated: CinematicProduction = {
    ...project,
    assets: [...project.assets, asset],
  };
  updated = recordMediaQaEvidence(updated, asset.id, result.mediaQa);
  updated = updateTaskWithEvidence(updated, task.id, {
    status: result.status === 'qa_passed' ? 'completed' : 'failed',
    evidence: JSON.stringify({
      distributionAssetId: asset.id,
      sha256: result.contentHash,
      qaStatus: result.status,
      recordedBy: result.mediaQa.recordedBy,
      recordedAt: result.mediaQa.recordedAt,
    }),
  });
  updated = {
    ...updated,
    tasks: updated.tasks.map(item => item.id === task.id
      ? { ...item, outputAssetIds: [...new Set([...item.outputAssetIds, asset.id])] }
      : item),
  };
  return { production: updated, asset: updated.assets.find(item => item.id === asset.id)!, export: result };
}


export type ProductionExportPersistence = {
  graphStatus: number;
  qaStatus: number;
};

/**
 * Persist a worker result in two retryable, auditable steps:
 * 1. PATCH the production graph without machine QA evidence (the API rejects QA changes here).
 * 2. POST the exact hash-bound QA record through the dedicated endpoint.
 * If step 2 fails, the asset remains visible but delivery readiness stays blocked;
 * retrying this function is safe because the first PATCH preserves the same asset IDs.
 */

export async function persistProductionExportResult(
  apiBaseUrl: string,
  projectId: string,
  result: ProductionExportResult,
  serviceSecret: string,
  fetcher: typeof fetch = fetch,
): Promise<ProductionExportPersistence> {
  if (!serviceSecret.trim()) throw new Error('Creator service credential is required to persist export evidence.');
  const base = new URL(apiBaseUrl);
  if (base.protocol !== 'https:' && base.hostname !== 'localhost' && base.hostname !== '127.0.0.1') {
    throw new Error('Creator API persistence requires HTTPS outside localhost.');
  }
  if (!projectId.trim() || result.production.id !== projectId || !result.asset.id) {
    throw new Error('Worker result project and asset identity must match the persistence target.');
  }
  const asset = result.production.assets.find(item => item.id === result.asset.id);
  if (!asset || asset.contentHash?.toLowerCase() !== result.export.contentHash.toLowerCase()
    || asset.mediaQa?.assetContentHash.toLowerCase() !== result.export.mediaQa.assetContentHash.toLowerCase()
    || JSON.stringify(asset.mediaQa) !== JSON.stringify(result.export.mediaQa)) {
    throw new Error('Worker result asset hash and QA evidence must agree exactly.');
  }
  const projectUrl = new URL(`/api/cinematic/projects/${encodeURIComponent(projectId)}`, base);
  const headers = { 'content-type': 'application/json', 'x-creator-generation-secret': serviceSecret };
  const currentResponse = await fetcher(projectUrl, { method: 'GET', headers });
  if (!currentResponse.ok) throw new Error(`Creator API project read failed with HTTP ${currentResponse.status}.`);
  const currentPayload = await currentResponse.json() as { production?: CinematicProduction };
  const current = currentPayload.production;
  if (!current || current.id !== projectId) throw new Error('Creator API did not return the canonical production graph.');

  const existing = current.assets.find(item => item.id === asset.id);
  if (existing?.mediaQa) {
    if (existing.contentHash?.toLowerCase() !== result.export.contentHash.toLowerCase()
      || JSON.stringify(existing.mediaQa) !== JSON.stringify(result.export.mediaQa)) {
      throw new Error('A different export or QA record already exists for this asset ID.');
    }
    return { graphStatus: currentResponse.status, qaStatus: currentResponse.status };
  }

  let graphToPersist = current;
  if (existing) {
    if (existing.contentHash?.toLowerCase() !== asset.contentHash?.toLowerCase()
      || existing.storageKey !== asset.storageKey || existing.status !== asset.status) {
      throw new Error('An incomplete export asset exists with conflicting hash, storage key or status.');
    }
  } else {
    const masterId = asset.parentAssetIds[0];
    const master = current.assets.find(item => item.id === masterId);
    const task = current.tasks.find(item => item.id === result.production.tasks.find(candidate => candidate.outputAssetIds.includes(asset.id))?.id);
    if (!master || master.role !== 'master' || master.status !== 'completed'
      || master.contentHash !== result.production.assets.find(item => item.id === masterId)?.contentHash
      || !task || task.kind !== 'export' || !task.inputAssetIds.includes(master.id)
      || !getRunnableTasks(current).some(item => item.id === task.id)) {
      throw new Error('The canonical project no longer satisfies the master/export task preconditions.');
    }
    const { mediaQa: _qa, ...assetWithoutQa } = asset;
    const completedTask = result.production.tasks.find(item => item.id === task.id)!;
    graphToPersist = {
      ...current,
      assets: [...current.assets, assetWithoutQa],
      tasks: current.tasks.map(item => item.id === task.id ? {
        ...item,
        status: completedTask.status,
        evidence: completedTask.evidence,
        outputAssetIds: [...new Set([...item.outputAssetIds, asset.id])],
      } : item),
    };
  }

  if (!existing) {
    const graphResponse = await fetcher(projectUrl, {
      method: 'PATCH', headers, body: JSON.stringify({ production: graphToPersist }),
    });
    if (!graphResponse.ok) throw new Error(`Creator API rejected the production export graph with HTTP ${graphResponse.status}.`);
  }

  const qaUrl = new URL(`/api/cinematic/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(asset.id)}/media-qa`, base);
  const qaResponse = await fetcher(qaUrl, {
    method: 'POST', headers, body: JSON.stringify({ evidence: result.export.mediaQa }),
  });
  if (!qaResponse.ok) {
    throw new Error(`Creator API rejected media QA evidence with HTTP ${qaResponse.status}; the export asset remains recorded but distribution stays gated.`);
  }
  return { graphStatus: existing ? currentResponse.status : 200, qaStatus: qaResponse.status };
}
