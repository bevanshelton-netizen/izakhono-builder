import {
  executeProductionDistributionExport,
  type ProductionExportRequest,
} from './cinematic-media-export-worker';
import type { CinematicProduction } from './cinematic-production-graph';
import type { MediaExportRuntime } from './media-export-executor';
import {
  getProject,
  saveProjectIfUnchanged,
  type CreatorStorageEnv,
} from './project-store';

export type ReconciliableDistributionStore = {
  put(key: string, bytes: Uint8Array, metadata: { contentType: string; sha256: string }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type DistributionWorkerDependencies = {
  authenticate(request: Request): Promise<boolean>;
  runtime: MediaExportRuntime;
  store: ReconciliableDistributionStore;
  resolveStoredAsset(storageKey: string): Promise<string>;
  allocateOutputPath(projectId: string, assetId: string): Promise<string>;
  workerIdentity: string;
  now?: () => string;
};

type ExportBody = {
  expectedUpdatedAt?: unknown;
  masterAssetId?: unknown;
  exportTaskId?: unknown;
  outputAssetId?: unknown;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Node-hosted distribution-export intake. Authentication, local output-path
 * allocation and source-object resolution are injected by the trusted worker
 * host; no caller can supply a filesystem path or arbitrary destination key.
 *
 * The export object is written before the graph CAS. If the CAS loses a race,
 * the object is deleted. A failed delete is surfaced as an explicit
 * reconciliation-required condition rather than silently orphaning bytes.
 */
export async function handleDistributionExportRequest(
  request: Request,
  env: CreatorStorageEnv,
  dependencies: DistributionWorkerDependencies,
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/internal\/creator\/projects\/([^/]+)\/distribution-export$/);
  if (!match) return null;
  if (request.method !== 'POST') return json({ error: 'POST is required.' }, 405);

  let authenticated = false;
  try {
    authenticated = await dependencies.authenticate(request);
  } catch {
    return json({ error: 'Worker authentication could not be verified.' }, 503);
  }
  if (!authenticated) return json({ error: 'Worker authentication required.' }, 401);
  if (!env.DB) return json({ error: 'Creator D1 storage is required.' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 16_384) return json({ error: 'Export request exceeds the 16 KB limit.' }, 413);
  const body = await request.json().catch(() => null) as ExportBody | null;
  if (!body || !isNonEmptyString(body.expectedUpdatedAt) ||
      !isNonEmptyString(body.masterAssetId) || !isNonEmptyString(body.exportTaskId) ||
      !isNonEmptyString(body.outputAssetId)) {
    return json({ error: 'expectedUpdatedAt, masterAssetId, exportTaskId and outputAssetId are required.' }, 400);
  }
  if (!isNonEmptyString(dependencies.workerIdentity)) {
    return json({ error: 'A configured worker identity is required.' }, 503);
  }

  let projectId: string;
  try {
    projectId = decodeURIComponent(match[1]);
  } catch {
    return json({ error: 'Invalid project identifier encoding.' }, 400);
  }
  if (!projectId.trim() || projectId.length > 160) return json({ error: 'Invalid project identifier.' }, 400);

  const project = await getProject(env, projectId);
  if (!project) return json({ error: 'Project not found.' }, 404);
  if (project.updatedAt !== body.expectedUpdatedAt) {
    return json({ error: 'Project version changed before export began; reload the canonical graph and retry.' }, 409);
  }
  const packageData = project.packageData;
  if (!packageData || typeof packageData !== 'object' || Array.isArray(packageData)) {
    return json({ error: 'Project package does not contain a cinematic production graph.' }, 409);
  }
  const packageRecord = packageData as Record<string, unknown>;
  const graph = packageRecord.cinematicProduction;
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    return json({ error: 'Project package does not contain a cinematic production graph.' }, 409);
  }

  const objectKey = `projects/${encodeURIComponent(projectId)}/exports/${encodeURIComponent(body.outputAssetId)}.mp4`;
  let uploaded = false;
  try {
    const outputPath = await dependencies.allocateOutputPath(projectId, body.outputAssetId);
    if (!isNonEmptyString(outputPath)) throw new Error('Trusted worker output-path allocator returned an empty path.');
    const exportRequest: ProductionExportRequest = {
      masterAssetId: body.masterAssetId,
      exportTaskId: body.exportTaskId,
      outputAssetId: body.outputAssetId,
      outputPath,
      objectKey,
      recordedBy: dependencies.workerIdentity,
    };
    const result = await executeProductionDistributionExport(
      graph as CinematicProduction,
      exportRequest,
      dependencies.runtime,
      {
        async put(key, bytes, metadata) {
          await dependencies.store.put(key, bytes, metadata);
          uploaded = true;
        },
      },
      dependencies.resolveStoredAsset,
      dependencies.now,
    );
    if (result.export.status !== 'qa_passed') {
      // Failed QA is recorded in the graph but never uploaded by exportAndStore.
      const failedPackage = { ...packageRecord, cinematicProduction: result.production };
      const saved = await saveProjectIfUnchanged(env, {
        id: project.id,
        brief: result.production.brief,
        packageData: failedPackage,
      }, project.updatedAt);
      if (!saved) return json({ error: 'Project changed while recording failed export QA; no deliverable was stored.' }, 409);
      return json({ status: 'qa_failed', asset: result.asset, mediaQa: result.export.mediaQa }, 422);
    }

    const nextPackage = { ...packageRecord, cinematicProduction: result.production };
    let committed = false;
    try {
      committed = await saveProjectIfUnchanged(env, {
        id: project.id,
        brief: result.production.brief,
        packageData: nextPackage,
      }, project.updatedAt);
    } catch (error) {
      try {
        if (uploaded) await dependencies.store.delete(objectKey);
      } catch {
        return json({ error: 'Graph persistence failed and uploaded export cleanup failed; operator reconciliation is required.', objectKey }, 500);
      }
      throw error;
    }
    if (!committed) {
      try {
        if (uploaded) await dependencies.store.delete(objectKey);
      } catch {
        return json({ error: 'Project version conflict and uploaded export cleanup failed; operator reconciliation is required.', objectKey }, 500);
      }
      return json({ error: 'Project changed during export; the uncommitted export object was removed. Reload and retry.' }, 409);
    }
    return json({
      status: 'completed',
      projectId,
      projectUpdatedAt: result.production.metadata.updatedAt,
      asset: result.asset,
      mediaQa: result.export.mediaQa,
      contentHash: result.export.contentHash,
      byteLength: result.export.byteLength,
      objectKey,
    }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Distribution export failed.' }, 422);
  }
}
