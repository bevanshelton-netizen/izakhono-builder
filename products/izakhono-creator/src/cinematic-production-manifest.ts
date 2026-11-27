import { hasPassingHumanMediaReview, type CinematicProduction, type ProductionAsset, type ProductionTask } from './cinematic-production-graph';

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
const requiredFacebookQaChecks = [
  'container-mp4', 'duration-positive', 'video-stream-present', 'video-stream-count',
  'video-h264', 'video-dimensions', 'video-pixel-format', 'video-frame-rate',
  'audio-stream-present', 'audio-stream-count', 'audio-aac', 'audio-sample-rate',
  'audio-stereo', 'mp4-fast-start',
];
const hasVerifiedFacebookQa = (asset: ProductionAsset): boolean => {
  const qa = asset.mediaQa;
  if (!qa || qa.schema !== 'izakhono.creator/media-qa-evidence-v1' || !qa.passed) return false;
  if (qa.profileId !== 'facebook-reels-1080x1920-v1') return false;
  if (!asset.contentHash || !/^[a-f0-9]{64}$/i.test(asset.contentHash) || qa.assetContentHash.toLowerCase() !== asset.contentHash.toLowerCase()) return false;
  if (!qa.recordedAt || !Number.isFinite(Date.parse(qa.recordedAt)) || !qa.recordedBy?.trim()) return false;
  if (!Array.isArray(qa.checks)) return false;
  const checks = new Map<string, (typeof qa.checks)[number]>();
  for (const check of qa.checks) {
    if (!check.id?.trim() || checks.has(check.id) || !check.actual?.trim() || !check.expected?.trim()) return false;
    checks.set(check.id, check);
  }
  return requiredFacebookQaChecks.every(id => checks.get(id)?.passed === true);
};
const hasRightsEvidence = (project: CinematicProduction, asset: ProductionAsset): boolean => {
  if (!asset.provenance.licence?.trim()) return false;
  if (asset.role === 'source' && asset.sourceEvidence && asset.sourceEvidence.rightsReviewStatus !== 'verified') return false;
  const shot = asset.shotId ? project.shots.find(item => item.id === asset.shotId) : undefined;
  const requiredConsentIds = shot
    ? project.characters.filter(character => shot.characterIds.includes(character.id)).map(character => character.consentRecordId).filter((id): id is string => Boolean(id))
    : [];
  return requiredConsentIds.every(id => asset.provenance.consentRecordIds.includes(id));
};
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
    const shotCharacters = project.characters.filter(character => shot.characterIds.includes(character.id));
    const requiredConsentIds = shotCharacters.map(character => character.consentRecordId).filter((id): id is string => Boolean(id));
    const consentCovered = requiredConsentIds.every(id => linked.some(asset => asset.provenance.consentRecordIds.includes(id)));
    const details = [
      video ? 'Completed shot video linked' : 'Missing completed shot video',
      image ? 'Completed source/reference image linked' : 'No completed source/reference image linked',
      audio ? 'Completed shot audio linked' : 'No completed shot audio linked',
      shot.continuityLocks.length ? `Continuity locks recorded: ${shot.continuityLocks.join(', ')}` : 'No shot continuity locks recorded',
      requiredConsentIds.length ? (consentCovered ? 'Applicable character consent records linked' : 'Applicable character consent evidence missing') : 'No character consent record is declared as applicable',
    ];
    entries.push({ id: shot.id, category: 'shot', label: `Shot ${shot.sequence}: ${shot.purpose}`, state: video ? 'complete' : linked.some(a=>a.status==='submitted'||a.status==='processing') ? 'in_progress' : 'missing', relatedIds: [shot.id, ...linked.map(a=>a.id)], details });
  }
  for (const asset of project.assets) {
    const linked = Boolean(asset.storageKey || asset.contentHash);
    const licenceRecorded = Boolean(asset.provenance.licence?.trim());
    const shot = asset.shotId ? project.shots.find(item => item.id === asset.shotId) : undefined;
    const applicableConsentIds = shot
      ? project.characters.filter(character => shot.characterIds.includes(character.id)).map(character => character.consentRecordId).filter((id): id is string => Boolean(id))
      : [];
    const consentCovered = applicableConsentIds.every(id => asset.provenance.consentRecordIds.includes(id));
    const evidenceComplete = asset.status === 'completed' && linked && hasRightsEvidence(project, asset);
    const assetState: ManifestState = evidenceComplete ? 'complete' : asset.status === 'failed' || asset.status === 'cancelled' ? 'blocked' : asset.status === 'submitted' || asset.status === 'processing' ? 'in_progress' : 'missing';
    entries.push({
      id: asset.id, category: 'asset', label: asset.role ?? asset.kind, state: assetState,
      relatedIds: [asset.sceneId,asset.shotId,asset.createdByTaskId,...asset.provenance.consentRecordIds].filter((x): x is string=>Boolean(x)),
      details: [
        `kind=${asset.kind}`, `source=${asset.source}`, `status=${asset.status}`,
        linked ? 'Storage key or content hash recorded' : 'No storage key or content hash recorded',
        asset.sourceEvidence ? 'Source rights review=' + asset.sourceEvidence.rightsReviewStatus : '',
        asset.provenance.createdAt ? `createdAt=${asset.provenance.createdAt}` : 'Creation timestamp not recorded',
        asset.mediaQa ? `mediaQa=${asset.mediaQa.passed ? 'passed' : 'failed'}; profile=${asset.mediaQa.profileId}; hash=${asset.mediaQa.assetContentHash}; recordedBy=${asset.mediaQa.recordedBy}; recordedAt=${asset.mediaQa.recordedAt}` : 'No media QA evidence recorded',
        asset.mediaQa ? `mediaQaChecks=${asset.mediaQa.checks.filter(check => check.passed).length}/${asset.mediaQa.checks.length} passed` : '',
        asset.humanReviews?.length ? `humanReviews=${asset.humanReviews.length}; latest=${asset.humanReviews.at(-1)?.passed ? 'passed' : 'failed'}; reviewer=${asset.humanReviews.at(-1)?.recordedBy}; recordedAt=${asset.humanReviews.at(-1)?.recordedAt}` : 'No human media review recorded',
        licenceRecorded ? `licence=${asset.provenance.licence}` : 'Licence not recorded',
        applicableConsentIds.length ? (consentCovered ? 'Applicable consent evidence linked' : 'Applicable consent evidence missing') : 'No character consent record is declared as applicable',
      ],
    });
  }
  for (const task of project.tasks) entries.push({ id: task.id, category: 'task', label: task.kind, state: stateForTask(task), relatedIds: [...task.inputAssetIds,...task.outputAssetIds,...(task.shotId?[task.shotId]:[])], details: [`status=${task.status}`,task.evidence ? 'Completion evidence recorded' : 'No completion evidence',task.errorMessage ?? ''] .filter(Boolean) });
  for (const approval of project.approvals) entries.push({ id: approval.id, category: 'approval', label: `${approval.gate} approval`, state: approval.status === 'approved' ? 'complete' : approval.status === 'rejected' ? 'blocked' : 'missing', relatedIds: [], details: [`status=${approval.status}`,approval.approverId ? `approver=${approval.approverId}` : 'Approver not recorded',approval.decidedAt ? `decidedAt=${approval.decidedAt}` : 'Decision timestamp not recorded'] });
  const masterAssets = project.assets.filter(asset => asset.role === 'master' && asset.kind === 'video' && asset.status === 'completed' && Boolean(asset.storageKey || asset.contentHash));
  const exportAssets = project.assets.filter(asset => asset.role === 'distribution_export' && asset.kind === 'video' && asset.status === 'completed' && Boolean(asset.storageKey?.trim() && asset.contentHash && /^[a-f0-9]{64}$/i.test(asset.contentHash)));
  const verifiedExportAssets = exportAssets.filter(hasVerifiedFacebookQa);
  const humanReviewedExportAssets = verifiedExportAssets.filter(hasPassingHumanMediaReview);
  entries.push({ id: 'master-delivery', category: 'export', label: 'Approved master video', state: masterAssets.length ? 'complete' : 'missing', relatedIds: masterAssets.map(asset=>asset.id), details: masterAssets.length ? ['Master asset and storage evidence recorded', 'Verify Facebook profile metadata and run media QA against the actual export'] : ['No completed, stored master video asset'] });
  entries.push({
    id: 'distribution-delivery', category: 'export', label: 'Distribution export',
    state: humanReviewedExportAssets.length ? 'complete' : exportAssets.length ? 'blocked' : 'missing',
    relatedIds: exportAssets.map(asset=>asset.id),
    details: humanReviewedExportAssets.length
      ? humanReviewedExportAssets.map(asset => `Asset ${asset.id}: machine QA passed for SHA-256 ${asset.contentHash}; human review passed by ${asset.humanReviews!.at(-1)!.recordedBy} at ${asset.humanReviews!.at(-1)!.recordedAt}`)
      : verifiedExportAssets.length
        ? ['Machine QA passed, but required human playback, audio, captions, continuity and private-upload review is missing or failed']
        : exportAssets.length
          ? ['Stored export exists, but hash-bound Facebook QA evidence is missing, incomplete, failed or does not match the asset bytes']
        : ['No completed, stored distribution export asset'],
  });
  const count = (state: ManifestState) => entries.filter(entry=>entry.state===state).length;
  const readyForMaster = isApproved(project,'creative') && isApproved(project,'generation') && project.shots.length>0 && project.shots.every(shot=>assetsForShot(project.assets,shot.id).some(asset=>asset.kind==='video' && asset.role==='shot_video' && asset.status==='completed' && Boolean(asset.storageKey || asset.contentHash) && hasRightsEvidence(project, asset)));
  const readyForDistribution = readyForMaster && isApproved(project,'master') && isApproved(project,'distribution') && masterAssets.length>0 && humanReviewedExportAssets.length>0;
  return { schema:'izakhono.creator/production-manifest-v1', productionId:project.id, productionTitle:project.title, generatedAt, summary:{total:entries.length,complete:count('complete'),inProgress:count('in_progress'),missing:count('missing'),blocked:count('blocked'),readyForMaster,readyForDistribution},entries };
}
