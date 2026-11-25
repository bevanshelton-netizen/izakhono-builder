import { getRunnableTasks, validateProductionGraph, updateTaskWithEvidence, type CinematicProduction } from './cinematic-production-graph';
import { buildProductionManifest } from './cinematic-production-manifest';

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

console.log('IZAKHONO CINEMATIC production graph: PASS');
