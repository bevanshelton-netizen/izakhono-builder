import { getRunnableTasks, validateProductionGraph, updateTaskWithEvidence, type CinematicProduction } from './cinematic-production-graph';

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
    { id: 't2', kind: 'video_generation', status: 'blocked', dependsOnTaskIds: ['t1'], inputAssetIds: [], outputAssetIds: [], shotId: 'sh1', attempts: 0 },
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

console.log('IZAKHONO CINEMATIC production graph: PASS');
