import { getRunnableTasks, validateProductionGraph, updateTaskWithEvidence, recordMediaQaEvidence, recordHumanMediaReview, type CinematicProduction } from './cinematic-production-graph';
import { buildProductionManifest } from './cinematic-production-manifest';
import { buildProductionReadinessReport } from './cinematic-production-readiness';

const project: CinematicProduction = {
  schema: 'izakhono.cinematic/production-v1', id: 'p1', title: 'Test production',
  brief: 'Create a short cinematic film', status: 'planned', format: 'film', publicLive: false,
  characters: [{ id: 'c1', name: 'Lead', description: 'Original fictional character', referenceAssetIds: [], wardrobeByScene: {}, lockedFacts: ['red coat'], allowedVariations: [] }],
  locations: [{ id: 'l1', name: 'Station', description: 'Train station', geography: 'Platform 2', timeOfDay: 'night', lighting: 'cool overhead', palette: ['blue'], referenceAssetIds: [], lockedFacts: [] }],
  props: [{ id: 'pr1', name: 'Case', description: 'Leather case', referenceAssetIds: [], continuityState: 'closed', lockedFacts: ['brown leather'] }],
  scenes: [{ id: 's1', sequence: 1, title: 'Arrival', synopsis: 'The lead arrives', locationId: 'l1', characterIds: ['c1'], propIds: ['pr1'], timeOfDay: 'night', emotionalBeat: 'anticipation', estimatedDurationSeconds: 20, continuityNotes: [] }],
  shots: [
    { id: 'sh1', sceneId: 's1', sequence: 1, purpose: 'Establish place', action: 'Train arrives', shotSize: 'wide', cameraAngle: 'eye-level', lensIntent: 'wide establishing', cameraMove: 'tracking', focusIntent: 'deep', lightingIntent: 'cool station lights', durationSeconds: 8, aspectRatio: '16:9', characterIds: ['c1'], propIds: ['pr1'], referenceIds: [], dependsOnShotIds: [], continuityLocks: ['night', 'red coat'] },
    { id: 'sh2', sceneId: 's1', sequence: 2, purpose: 'Reveal character', action: 'Lead steps onto platform', shotSize: 'medium', cameraAngle: 'eye-level', lensIntent: 'natural perspective', cameraMove: 'dolly', focusIntent: 'lead face', lightingIntent: 'match previous shot', durationSeconds: 12, aspectRatio: '16:9', characterIds: ['c1'], propIds: ['pr1'], referenceIds: [], dependsOnShotIds: ['sh1'], continuityLocks: ['night', 'red coat'] },
  ],
  references: [], assets: [],
  tasks: [
    { id: 't1', kind: 'storyboard', status: 'ready', dependsOnTaskIds: [], inputAssetIds: [], outputAssetIds: [], attempts: 0 },
    { id: 't2', kind: 'video_generation', status: 'blocked', blockedReason: 'dependencies', dependsOnTaskIds: ['t1'], inputAssetIds: [], outputAssetIds: [], shotId: 'sh1', attempts: 0 },
  ],
  approvals: [
    { id: 'a1', gate: 'creative', status: 'pending' }, { id: 'a2', gate: 'generation', status: 'pending' },
    { id: 'a3', gate: 'master', status: 'pending' }, { id: 'a4', gate: 'distribution', status: 'pending' },
  ],
  metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ownerId: 'owner', tags: [], version: 1 },
};

const issues = validateProductionGraph(project);
if (issues.some(x => x.severity === 'error')) throw new Error(`Valid graph rejected: ${JSON.stringify(issues)}`);
if (getRunnableTasks(project).map(x => x.id).join(',') !== 't1') throw new Error('Runnable task resolver is incorrect');
const completed = updateTaskWithEvidence(project, 't1', { status: 'completed', evidence: 'test://storyboard-proof' });
if (!getRunnableTasks(completed).some(x => x.id === 't2')) throw new Error('Downstream task did not unlock after evidence-backed completion');
let missingEvidenceRejected = false;
try { updateTaskWithEvidence(project, 't1', { status: 'completed' }); } catch { missingEvidenceRejected = true; }
if (!missingEvidenceRejected) throw new Error('Completion without evidence must be rejected');

const cyclic = { ...project, tasks: [
  { id: 'x1', kind: 'edit' as const, status: 'ready' as const, dependsOnTaskIds: ['x2'], inputAssetIds: [], outputAssetIds: [], attempts: 0 },
  { id: 'x2', kind: 'render' as const, status: 'ready' as const, dependsOnTaskIds: ['x1'], inputAssetIds: [], outputAssetIds: [], attempts: 0 },
] };
if (!validateProductionGraph(cyclic).some(x => x.code === 'DEPENDENCY_CYCLE')) throw new Error('Dependency cycles must be rejected');


const traced = {
  ...project,
  assets: [{
    id: 'asset-video-1', kind: 'video' as const, status: 'completed' as const,
    source: 'owned_model' as const, role: 'shot_video' as const,
    sceneId: 's1', shotId: 'sh1', createdByTaskId: 't2',
    parentAssetIds: [], provenance: { createdAt: '2026-01-01T00:00:00.000Z', consentRecordIds: [] },
  }],
  tasks: project.tasks.map(task => task.id === 't2' ? { ...task, outputAssetIds: ['asset-video-1'] } : task),
};
if (validateProductionGraph(traced).some(x => x.severity === 'error')) throw new Error('Valid scene/shot/task asset traceability rejected');
const mismatchedAsset = {
  ...traced,
  assets: traced.assets.map(asset => ({ ...asset, sceneId: 'missing-scene' })),
};
if (!validateProductionGraph(mismatchedAsset).some(x => x.code === 'UNKNOWN_ASSET_SCENE')) throw new Error('Unknown asset scene must be rejected');
const mismatchedCreator = {
  ...traced,
  assets: traced.assets.map(asset => ({ ...asset, createdByTaskId: 't1' })),
};
if (!validateProductionGraph(mismatchedCreator).some(x => x.code === 'ASSET_TASK_OUTPUT_MISMATCH')) throw new Error('Asset/task creator mismatch must be rejected');
const mismatchedSceneShot = {
  ...traced,
  scenes: [...project.scenes, { ...project.scenes[0], id: 's2', sequence: 2 }],
  assets: traced.assets.map(asset => ({ ...asset, sceneId: 's2' })),
};
if (!validateProductionGraph(mismatchedSceneShot).some(x => x.code === 'ASSET_SCENE_SHOT_MISMATCH')) throw new Error('Asset scene/shot mismatch must be rejected');


const manifest = buildProductionManifest(project, '2026-11-25T00:00:00.000Z');
if (manifest.schema !== 'izakhono.creator/production-manifest-v1') throw new Error('Production manifest schema is incorrect');
if (manifest.entries.filter(entry => entry.category === 'shot').length !== project.shots.length) throw new Error('Manifest must include every planned shot');
if (manifest.summary.readyForMaster || manifest.summary.readyForDistribution) throw new Error('Manifest must not report delivery readiness without completed stored shot media and approvals');
if (!manifest.entries.some(entry => entry.category === 'export' && entry.state === 'missing')) throw new Error('Missing master/export evidence must be visible');
const completeShotProject: CinematicProduction = {
  ...project,
  approvals: project.approvals.map(approval => ({ ...approval, status: 'approved' as const, approverId: 'producer', decidedAt: '2026-11-25T00:00:00.000Z' })),
  assets: project.shots.map(shot => ({
    id: `video-${shot.id}`, kind: 'video' as const, status: 'completed' as const,
    source: 'owned_model' as const, role: 'shot_video' as const, sceneId: shot.sceneId, shotId: shot.id,
    storageKey: `projects/p1/${shot.id}.mp4`, parentAssetIds: [],
    provenance: { createdAt: '2026-11-25T00:00:00.000Z', licence: 'owned', consentRecordIds: [] },
  })),
};
const readyManifest = buildProductionManifest(completeShotProject);
if (!readyManifest.summary.readyForMaster) throw new Error('Manifest should recognize fully evidenced approved shot media');
if (readyManifest.summary.readyForDistribution) throw new Error('Distribution must remain blocked until master and distribution exports are recorded');

const facebookQaChecks = [
  'container-mp4', 'duration-positive', 'video-stream-present', 'video-stream-count',
  'video-h264', 'video-dimensions', 'video-pixel-format', 'video-frame-rate',
  'audio-stream-present', 'audio-stream-count', 'audio-aac', 'audio-sample-rate',
  'audio-stereo', 'mp4-fast-start',
].map(id => ({ id, passed: true, actual: 'verified', expected: 'profile requirement' }));
const distributionAssets: CinematicProduction = {
  ...completeShotProject,
  assets: [
    ...completeShotProject.assets,
    { id: 'master-1', kind: 'video', status: 'completed', source: 'assembled', role: 'master', storageKey: 'projects/p1/master.mp4', contentHash: 'master-sha256', parentAssetIds: [], provenance: { createdAt: '2026-11-25T00:00:00.000Z', licence: 'owned', consentRecordIds: [] } },
    { id: 'export-1', kind: 'video', status: 'completed', source: 'assembled', role: 'distribution_export', storageKey: 'projects/p1/facebook.mp4', contentHash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', parentAssetIds: ['master-1'], provenance: { createdAt: '2026-11-25T00:00:00.000Z', licence: 'owned', consentRecordIds: [] } },
  ],
};
if (buildProductionManifest(distributionAssets).summary.readyForDistribution) throw new Error('A stored Facebook export without media QA evidence must not unlock distribution');
const qaVerifiedDistribution: CinematicProduction = {
  ...distributionAssets,
  assets: distributionAssets.assets.map(asset => asset.id === 'export-1' ? {
    ...asset,
    mediaQa: {
      schema: 'izakhono.creator/media-qa-evidence-v1' as const,
      profileId: 'facebook-reels-1080x1920-v1',
      passed: true,
      assetContentHash: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      recordedAt: '2026-11-25T00:05:00.000Z',
      recordedBy: 'media-qa-worker',
      checks: facebookQaChecks,
    },
  } : asset),
};

if (buildProductionManifest(qaVerifiedDistribution).summary.readyForDistribution) throw new Error('Machine QA alone must not unlock distribution without human review');
const manifestReview = {
  schema: 'izakhono.creator/human-media-review-v1' as const,
  profileId: 'facebook-reels-1080x1920-v1',
  reviewId: 'manifest-human-review',
  assetContentHash: 'e'.repeat(64),
  passed: true,
  recordedAt: '2026-11-25T00:10:00.000Z',
  recordedBy: 'human-reviewer',
  checks: [
    { id: 'full-playback-integrity', passed: true, finding: 'Full playback checked.' },
    { id: 'dialogue-music-effects', passed: true, finding: 'Audio clarity and sync checked.' },
    { id: 'captions-safe-areas', passed: true, finding: 'Captions and safe areas checked.' },
    { id: 'continuity-titles-credits', passed: true, finding: 'Continuity and credits checked.' },
    { id: 'private-upload-playback', passed: true, finding: 'Private staging playback checked.' },
  ],
};
const humanReviewedDistribution = recordHumanMediaReview(qaVerifiedDistribution, 'export-1', manifestReview);
if (!buildProductionManifest(humanReviewedDistribution).summary.readyForDistribution) throw new Error('Machine QA plus hash-bound human review should unlock distribution readiness when approvals and master evidence exist');

const mismatchedQaHash: CinematicProduction = {
  ...humanReviewedDistribution,
  assets: humanReviewedDistribution.assets.map(asset => asset.id === 'export-1' ? { ...asset, mediaQa: { ...asset.mediaQa!, assetContentHash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' } } : asset),
};
if (buildProductionManifest(mismatchedQaHash).summary.readyForDistribution) throw new Error('QA evidence for different bytes must not unlock distribution');
const missingFastStartQa: CinematicProduction = {
  ...humanReviewedDistribution,
  assets: humanReviewedDistribution.assets.map(asset => asset.id === 'export-1' ? { ...asset, mediaQa: { ...asset.mediaQa!, checks: asset.mediaQa!.checks.filter(check => check.id !== 'mp4-fast-start') } } : asset),
};
if (buildProductionManifest(missingFastStartQa).summary.readyForDistribution) throw new Error('Facebook QA without fast-start verification must not unlock distribution');
const duplicateQaCheck: CinematicProduction = {
  ...humanReviewedDistribution,
  assets: humanReviewedDistribution.assets.map(asset => asset.id === 'export-1' ? { ...asset, mediaQa: { ...asset.mediaQa!, checks: [...asset.mediaQa!.checks, asset.mediaQa!.checks[0]] } } : asset),
};
if (buildProductionManifest(duplicateQaCheck).summary.readyForDistribution) throw new Error('Duplicate QA check IDs must not unlock distribution');
const unauditedQaTimestamp: CinematicProduction = {
  ...qaVerifiedDistribution,
  assets: qaVerifiedDistribution.assets.map(asset => asset.id === 'export-1' ? { ...asset, mediaQa: { ...asset.mediaQa!, recordedAt: 'not-a-timestamp' } } : asset),
};
if (buildProductionManifest(unauditedQaTimestamp).summary.readyForDistribution) throw new Error('Invalid QA timestamps must not unlock distribution');
const malformedQaCheck: CinematicProduction = {
  ...qaVerifiedDistribution,
  assets: qaVerifiedDistribution.assets.map(asset => asset.id === 'export-1' ? { ...asset, mediaQa: { ...asset.mediaQa!, checks: asset.mediaQa!.checks.map((check, index) => index === 0 ? { ...check, actual: ' ' } : check) } } : asset),
};
if (buildProductionManifest(malformedQaCheck).summary.readyForDistribution) throw new Error('QA checks without actual evidence must not unlock distribution');
const malformedQaHash: CinematicProduction = {
  ...qaVerifiedDistribution,
  assets: qaVerifiedDistribution.assets.map(asset => asset.id === 'export-1' ? { ...asset, contentHash: 'not-a-sha256' } : asset),
};
if (buildProductionManifest(malformedQaHash).summary.readyForDistribution) throw new Error('Non-SHA-256 export hashes must not unlock distribution');



const unstoredShotProject: CinematicProduction = {
  ...completeShotProject,
  assets: completeShotProject.assets.map(asset => ({ ...asset, storageKey: undefined })),
};
const unstoredManifest = buildProductionManifest(unstoredShotProject);
if (unstoredManifest.summary.readyForMaster) throw new Error('Shot videos without storage/hash evidence must not unlock master readiness');
if (unstoredManifest.entries.filter(entry => entry.category === 'shot').some(entry => entry.state === 'complete')) throw new Error('Shot without stored video evidence must not be marked complete');
const unauditedApprovalProject: CinematicProduction = {
  ...completeShotProject,
  approvals: completeShotProject.approvals.map(approval => approval.gate === 'generation' ? { ...approval, approverId: undefined, decidedAt: undefined } : approval),
};
if (buildProductionManifest(unauditedApprovalProject).summary.readyForMaster) throw new Error('Approval without approver and decision timestamp must not unlock master readiness');


const readiness = buildProductionReadinessReport(project, '2026-11-25T00:00:00.000Z');
if (readiness.schema !== 'izakhono.creator/readiness-report-v1') throw new Error('Readiness report schema is incorrect');
if (readiness.state !== 'blocked') throw new Error('Production with missing approvals and exports must be blocked');
if (!readiness.actions.some(action => action.category === 'shot' && action.relatedIds.includes('sh1') && action.candidateTaskIds.includes('t2'))) throw new Error('Readiness report must connect shot gaps to candidate production tasks');
if (!readiness.actions.some(action => action.category === 'approval' && action.priority === 'critical')) throw new Error('Missing approval must be a critical readiness action');
if (readiness.actions.some((action, index) => index > 0 && action.priority === 'critical' && readiness.actions[index - 1].priority !== 'critical')) throw new Error('Readiness actions must be ordered by priority');


const unlicensedProject: CinematicProduction = {
  ...completeShotProject,
  assets: completeShotProject.assets.map(asset => ({ ...asset, provenance: { ...asset.provenance, licence: undefined } })),
};
const unlicensedManifest = buildProductionManifest(unlicensedProject);
if (unlicensedManifest.summary.readyForMaster) throw new Error('Shot media without recorded licence evidence must not unlock master readiness');
if (!unlicensedManifest.entries.some(entry => entry.category === 'asset' && entry.details.includes('Licence not recorded'))) throw new Error('Missing licence evidence must be visible in the manifest');

const consentRequiredProject: CinematicProduction = {
  ...completeShotProject,
  characters: project.characters.map(character => ({ ...character, consentRecordId: 'consent-lead-1' })),
};
const consentMissingManifest = buildProductionManifest(consentRequiredProject);
if (consentMissingManifest.summary.readyForMaster) throw new Error('Applicable character consent evidence must be linked before master readiness');
if (!consentMissingManifest.entries.some(entry => entry.category === 'asset' && entry.details.includes('Applicable consent evidence missing'))) throw new Error('Missing applicable consent evidence must be visible');

const consentCoveredProject: CinematicProduction = {
  ...consentRequiredProject,
  assets: completeShotProject.assets.map(asset => ({ ...asset, provenance: { ...asset.provenance, consentRecordIds: ['consent-lead-1'] } })),
};
if (!buildProductionManifest(consentCoveredProject).summary.readyForMaster) throw new Error('Recorded licence and applicable consent evidence should satisfy rights checks');


const qaAssetBase: CinematicProduction = {
  ...distributionAssets,
  assets: distributionAssets.assets.map(asset => asset.id === 'export-1' ? { ...asset, contentHash: 'c'.repeat(64) } : asset),
};
const evidenceForRecording = {
  schema: 'izakhono.creator/media-qa-evidence-v1' as const,
  profileId: 'facebook-reels-1080x1920-v1',
  passed: true,
  assetContentHash: 'c'.repeat(64),
  recordedAt: '2026-11-26T09:00:00.000Z',
  recordedBy: 'media-qa-worker',
  checks: facebookQaChecks,
};
const qaRecorded = recordMediaQaEvidence(qaAssetBase, 'export-1', evidenceForRecording);
if (qaRecorded.assets.find(asset => asset.id === 'export-1')?.mediaQa?.assetContentHash !== 'c'.repeat(64)) throw new Error('Media QA evidence was not attached to the canonical export asset');
if (qaRecorded.metadata.version !== qaAssetBase.metadata.version + 1) throw new Error('Recording QA evidence must increment the production graph version');
if (!buildProductionManifest(qaRecorded).summary.readyForDistribution) throw new Error('Recorded hash-bound QA evidence should satisfy the export QA gate when other gates pass');

if (buildProductionManifest(qaRecorded).summary.readyForDistribution) throw new Error('Machine QA alone must not unlock distribution without human review');
const humanReviewEvidence = {
  schema: 'izakhono.creator/human-media-review-v1' as const,
  profileId: 'facebook-reels-1080x1920-v1',
  reviewId: 'human-review-001',
  assetContentHash: 'c'.repeat(64),
  passed: true,
  recordedAt: '2026-11-26T09:30:00.000Z',
  recordedBy: 'producer-reviewer-1',
  checks: [
    { id: 'full-playback-integrity', passed: true, finding: 'Full file watched; no freezes or black frames.' },
    { id: 'dialogue-music-effects', passed: true, finding: 'Dialogue clear; music and effects synchronised.' },
    { id: 'captions-safe-areas', passed: true, finding: 'Captions checked for spelling, timing and mobile safe areas.' },
    { id: 'continuity-titles-credits', passed: true, finding: 'Continuity, titles, credits and end card reviewed.' },
    { id: 'private-upload-playback', passed: true, finding: 'Private staging upload played back successfully.' },
  ],
};

let wrongHashHumanReviewRejected = false;
try { recordHumanMediaReview(qaRecorded, 'export-1', { ...humanReviewEvidence, reviewId: 'human-review-wrong-hash', assetContentHash: 'd'.repeat(64) }); } catch { wrongHashHumanReviewRejected = true; }
if (!wrongHashHumanReviewRejected) throw new Error('Human review must be bound to the exact export SHA-256');

const humanReviewed = recordHumanMediaReview(qaRecorded, 'export-1', humanReviewEvidence);
if (!buildProductionManifest(humanReviewed).summary.readyForDistribution) throw new Error('Audited passing human review should unlock distribution readiness when all approvals exist');
const failedHumanReview = { ...humanReviewEvidence, reviewId: 'human-review-002', passed: false, checks: humanReviewEvidence.checks.map(check => check.id === 'captions-safe-areas' ? { ...check, passed: false, finding: 'Caption timing needs correction.' } : check) };
const withFailedReview = recordHumanMediaReview(humanReviewed, 'export-1', failedHumanReview);
if (withFailedReview.assets.find(asset => asset.id === 'export-1')?.humanReviews?.length !== 2) throw new Error('Human review history must be append-only');
if (buildProductionManifest(withFailedReview).summary.readyForDistribution) throw new Error('Latest failed human review must block distribution readiness');
let humanReviewWithoutMachineQaRejected = false;
try { recordHumanMediaReview(qaAssetBase, 'export-1', humanReviewEvidence); } catch { humanReviewWithoutMachineQaRejected = true; }
if (!humanReviewWithoutMachineQaRejected) throw new Error('Human review must require matching passing machine QA');

const failedEvidence = { ...evidenceForRecording, passed: false, checks: facebookQaChecks.map(check => check.id === 'mp4-fast-start' ? { ...check, passed: false } : check) };
const failedExportForRecording: CinematicProduction = { ...qaAssetBase, assets: qaAssetBase.assets.map(asset => asset.id === 'export-1' ? { ...asset, status: 'failed' as const, storageKey: undefined } : asset) };
const failedRecorded = recordMediaQaEvidence(failedExportForRecording, 'export-1', failedEvidence);
if (failedRecorded.assets.find(asset => asset.id === 'export-1')?.mediaQa?.passed !== false) throw new Error('Failed QA evidence must remain available for audit');
if (buildProductionManifest(failedRecorded).summary.readyForDistribution) throw new Error('Failed QA evidence must never unlock distribution');
for (const invalidEvidence of [
  { ...evidenceForRecording, assetContentHash: 'd'.repeat(64) },
  { ...evidenceForRecording, checks: facebookQaChecks.filter(check => check.id !== 'mp4-fast-start') },
  { ...evidenceForRecording, recordedBy: ' ' },
]) {
  let rejected = false;
  try { recordMediaQaEvidence(qaAssetBase, 'export-1', invalidEvidence); } catch { rejected = true; }
  if (!rejected) throw new Error('Invalid or incomplete media QA evidence must be rejected');
}

const failedLocalExport: CinematicProduction = {
  ...qaAssetBase,
  assets: qaAssetBase.assets.map(asset => asset.id === 'export-1' ? { ...asset, status: 'failed' as const, storageKey: undefined } : asset),
};
const failedLocalRecorded = recordMediaQaEvidence(failedLocalExport, 'export-1', failedEvidence);
const failedLocalEntry = buildProductionManifest(failedLocalRecorded).entries.find(entry => entry.id === 'export-1');
if (!failedLocalEntry?.details.some(detail => detail.includes('mediaQa=failed'))) throw new Error('Failed local export QA evidence must remain visible in the asset manifest');
if (buildProductionManifest(failedLocalRecorded).summary.readyForDistribution) throw new Error('Failed local export QA evidence must not unlock distribution');

const unstoredExport: CinematicProduction = {
  ...qaAssetBase,
  assets: qaAssetBase.assets.map(asset => asset.id === 'export-1' ? { ...asset, storageKey: undefined } : asset),
};
let unstoredExportRejected = false;
try { recordMediaQaEvidence(unstoredExport, 'export-1', evidenceForRecording); } catch { unstoredExportRejected = true; }
if (!unstoredExportRejected) throw new Error('QA evidence must not be attached before the export is stored');
const incompleteExport: CinematicProduction = {
  ...qaAssetBase,
  assets: qaAssetBase.assets.map(asset => asset.id === 'export-1' ? { ...asset, status: 'processing' as const } : asset),
};
let incompleteExportRejected = false;
try { recordMediaQaEvidence(incompleteExport, 'export-1', evidenceForRecording); } catch { incompleteExportRejected = true; }
if (!incompleteExportRejected) throw new Error('QA evidence must not be attached to an incomplete export');
let wrongRoleRejected = false;
try { recordMediaQaEvidence(completeShotProject, 'video-sh1', evidenceForRecording); } catch { wrongRoleRejected = true; }
if (!wrongRoleRejected) throw new Error('Media QA evidence must not be attached to a shot source asset');

console.log('IZAKHONO CINEMATIC production graph: PASS');
