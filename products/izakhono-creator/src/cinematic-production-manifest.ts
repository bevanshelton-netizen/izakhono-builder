import type { CinematicProduction, ProductionAsset, ProductionTask } from './cinematic-production-graph';

export type ManifestState = 'complete' | 'in_progress' | 'missing' | 'blocked';
export interface ManifestEntry {
  id: string;
  category: 'scene' | 'shot' | 'asset' | 'task' | 'approval' | 'export';
  label: string;
  state: ManifestState;
  relatedIds: string[];
  details: string[];
}
export interface ProductionManifest {
  schema: 'izakhono.creator/production-manifest-v1';
  productionId: string;
  productionTitle: string;
  generatedAt: string;
  summary: { total: number; complete: number; inProgress: number; missing: number; blocked: number; readyForMaster: boolean; readyForDistribution: boolean };
  entries: ManifestEntry[];
}

const isApproved = (project: CinematicProduction, gate: string) =>
  project.approvals.some(item => item.gate === gate && item.status === 'approved' && Boolean(item.approverId && item.decidedAt));
const assetsForShot = (assets: ProductionAsset[], shotId: string) => assets.filter(asset => asset.shotId === shotId);
const stateForTask = (task: ProductionTask): ManifestState =>
  task.status === 'completed' ? 'complete' :
  task.status === 'failed' || task.status === 'cancelled' ? 'blocked' :
  task.status === 'processing' || task.status === 'submitted' || task.status === 'queued' ? 'in_progress' :
  task.status === 'blocked' ? 'blocked' : 'missing';

/** Builds an evidence-oriented checklist. It reports missing evidence; it never creates or mutates production records. */
export function buildProductionManifest(project: CinematicProduction, generatedAt = new Date().toISOString()): ProductionManifest {
  const entries: ManifestEntry[] = [];
  for (const scene of [...project.scenes].sort((a,b) => a.sequence-b.sequence)) {
    const shots = project.shots.filter(shot => shot.sceneId === scene.id);
    entries.push({ id: scene.id, category: 'scene', label: scene.title, state: shots.length ? 'complete' : 'missing', relatedIds: shots.map(shot=>shot.id), details: shots.length ? [`${shots.length} planned shot(s)`] : ['No shots are assigned to this scene'] });
  }
  for (const shot of [...project.shots].sort((a,b) => a.sequence-b.sequence)) {
    const linked = assetsForShot(project.assets, shot.id);
    const video = linked.some(asset => asset.kind === 'video' && asset.status === 'completed' && asset.role === 'shot_video' && Boolean(asset.storageKey || asset.contentHash));
    const image = linked.some(asset => asset.kind === 'image' && asset.status === 'completed' && (asset.role === 'reference' || asset.role === 'source') && Boolean(asset.storageKey || asset.contentHash));
    const audio = linked.some(asset => asset.kind === 'audio' && asset.status === 'completed' && asset.role === 'shot_audio' && Boolean(asset.storageKey || asset.contentHash));
    const details = [
      video ? 'Completed shot video linked' : 'Missing completed shot video',
      image ? 'Completed source/reference image linked' : 'No completed source/reference image linked',
      audio ? 'Completed shot audio linked' : 'No completed shot audio linked',
    ];
    entries.push({ id: shot.id, category: 'shot', label: `Shot ${shot.sequence}: ${shot.purpose}`, state: video ? 'complete' : linked.some(a=>a.status==='submitted'||a.status==='processing') ? 'in_progress' : 'missing', relatedIds: linked.map(a=>a.id), details });
  }
  for (const asset of project.assets) {
    const linked = Boolean(asset.storageKey || asset.contentHash);
    entries.push({ id: asset.id, category: 'asset', label: asset.role ?? asset.kind, state: asset.status === 'completed' && linked ? 'complete' : asset.status === 'failed' || asset.status === 'cancelled' ? 'blocked' : asset.status === 'submitted' || asset.status === 'processing' ? 'in_progress' : 'missing', relatedIds: [asset.sceneId,asset.shotId,asset.createdByTaskId].filter((x): x is string=>Boolean(x)), details: [`kind=${asset.kind}`,`status=${asset.status}`,linked ? 'Storage key or content hash recorded' : 'No storage key or content hash recorded',asset.provenance.licence ? `licence=${asset.provenance.licence}` : 'Licence not recorded',asset.provenance.consentRecordIds.length ? 'Consent evidence linked' : 'No consent evidence linked'] });
  }
  for (const task of project.tasks) entries.push({ id: task.id, category: 'task', label: task.kind, state: stateForTask(task), relatedIds: [...task.inputAssetIds,...task.outputAssetIds,...(task.shotId?[task.shotId]:[])], details: [`status=${task.status}`,task.evidence ? 'Completion evidence recorded' : 'No completion evidence',task.errorMessage ?? ''] .filter(Boolean) });
  for (const approval of project.approvals) entries.push({ id: approval.id, category: 'approval', label: `${approval.gate} approval`, state: approval.status === 'approved' ? 'complete' : approval.status === 'rejected' ? 'blocked' : 'missing', relatedIds: [], details: [`status=${approval.status}`,approval.approverId ? `approver=${approval.approverId}` : 'Approver not recorded',approval.decidedAt ? `decidedAt=${approval.decidedAt}` : 'Decision timestamp not recorded'] });
  const masterAssets = project.assets.filter(asset => asset.role === 'master' && asset.kind === 'video' && asset.status === 'completed' && Boolean(asset.storageKey || asset.contentHash));
  const exportAssets = project.assets.filter(asset => asset.role === 'distribution_export' && asset.kind === 'video' && asset.status === 'completed' && Boolean(asset.storageKey || asset.contentHash));
  entries.push({ id: 'master-delivery', category: 'export', label: 'Approved master video', state: masterAssets.length ? 'complete' : 'missing', relatedIds: masterAssets.map(asset=>asset.id), details: masterAssets.length ? ['Master asset and storage evidence recorded'] : ['No completed, stored master video asset'] });
  entries.push({ id: 'distribution-delivery', category: 'export', label: 'Distribution export', state: exportAssets.length ? 'complete' : 'missing', relatedIds: exportAssets.map(asset=>asset.id), details: exportAssets.length ? ['Distribution export asset and storage evidence recorded'] : ['No completed, stored distribution export asset'] });
  const count = (state: ManifestState) => entries.filter(entry=>entry.state===state).length;
  const readyForMaster = isApproved(project,'creative') && isApproved(project,'generation') && project.shots.length>0 && project.shots.every(shot=>assetsForShot(project.assets,shot.id).some(asset=>asset.kind==='video' && asset.role==='shot_video' && asset.status==='completed' && Boolean(asset.storageKey || asset.contentHash)));
  const readyForDistribution = readyForMaster && isApproved(project,'master') && isApproved(project,'distribution') && masterAssets.length>0 && exportAssets.length>0;
  return { schema:'izakhono.creator/production-manifest-v1', productionId:project.id, productionTitle:project.title, generatedAt, summary:{total:entries.length,complete:count('complete'),inProgress:count('in_progress'),missing:count('missing'),blocked:count('blocked'),readyForMaster,readyForDistribution},entries };
}
