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
  if (!getRunnableTasks(project).some(item => item.id === task.id)) throw new Error('The export task is not runnable; complete its dependencies first.');
  if (!request.outputAssetId.trim() || !request.outputPath.trim() || !request.objectKey.trim() || !request.recordedBy.trim()) {
    throw new Error('Output asset ID, worker path, storage key and worker identity are required.');
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
