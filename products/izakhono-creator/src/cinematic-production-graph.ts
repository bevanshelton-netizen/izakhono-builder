/**
 * IZAKHONO CINEMATIC AI — canonical production graph.
 *
 * This is the domain contract for the complete creative production lifecycle.
 * It is deliberately provider-neutral: external or owned generation workers
 * consume graph tasks through adapters, never by mutating canonical project facts.
 */

export type ProductionId = string;
export type ProductionStatus = 'draft' | 'planned' | 'approved' | 'in_progress' | 'review' | 'completed' | 'archived';
export type TaskStatus = 'blocked' | 'ready' | 'approved' | 'queued' | 'submitted' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type MediaKind = 'image' | 'video' | 'audio' | '3d' | 'document';
export type ShotSize = 'extreme_wide' | 'wide' | 'full' | 'medium' | 'close_up' | 'extreme_close_up' | 'insert';
export type CameraMove = 'static' | 'pan' | 'tilt' | 'dolly' | 'tracking' | 'crane' | 'handheld' | 'orbit' | 'drone' | 'zoom';
export type ApprovalGate = 'creative' | 'generation' | 'master' | 'distribution';

export interface ProductionReference {
  id: ProductionId;
  assetId: ProductionId;
  role: 'identity' | 'wardrobe' | 'location' | 'prop' | 'style' | 'motion' | 'audio' | 'product' | 'other';
  notes?: string;
}

export interface CharacterBible {
  id: ProductionId;
  name: string;
  description: string;
  referenceAssetIds: ProductionId[];
  wardrobeByScene: Record<ProductionId, string[]>;
  voiceProfileId?: ProductionId;
  consentRecordId?: ProductionId;
  lockedFacts: string[];
  allowedVariations: string[];
}

export interface LocationBible {
  id: ProductionId;
  name: string;
  description: string;
  geography: string;
  timeOfDay: string;
  lighting: string;
  palette: string[];
  referenceAssetIds: ProductionId[];
  lockedFacts: string[];
}

export interface PropBible {
  id: ProductionId;
  name: string;
  description: string;
  referenceAssetIds: ProductionId[];
  continuityState: string;
  lockedFacts: string[];
}

export interface Scene {
  id: ProductionId;
  sequence: number;
  title: string;
  synopsis: string;
  locationId: ProductionId;
  characterIds: ProductionId[];
  propIds: ProductionId[];
  timeOfDay: string;
  emotionalBeat: string;
  estimatedDurationSeconds: number;
  continuityNotes: string[];
}

export interface Shot {
  id: ProductionId;
  sceneId: ProductionId;
  sequence: number;
  purpose: string;
  action: string;
  shotSize: ShotSize;
  cameraAngle: string;
  lensIntent: string;
  cameraMove: CameraMove;
  focusIntent: string;
  lightingIntent: string;
  durationSeconds: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '2.39:1' | 'custom';
  characterIds: ProductionId[];
  propIds: ProductionId[];
  referenceIds: ProductionId[];
  dependsOnShotIds: ProductionId[];
  firstFrameIntent?: string;
  lastFrameIntent?: string;
  continuityLocks: string[];
  generationPrompt?: string;
}

export interface ProductionAsset {
  id: ProductionId;
  kind: MediaKind;
  status: TaskStatus;
  source: 'user' | 'owned_model' | 'external_provider' | 'edited' | 'assembled';
  storageKey?: string;
  contentHash?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  provider?: string;
  externalJobId?: string;
  parentAssetIds: ProductionId[];
  provenance: {
    createdAt: string;
    licence?: string;
    consentRecordIds: string[];
    promptVersion?: string;
  };
}

export interface ProductionTask {
  id: ProductionId;
  kind: 'script' | 'storyboard' | 'image_generation' | 'video_generation' | 'audio_generation' | '3d_generation' | 'edit' | 'composite' | 'render' | 'quality_check' | 'export';
  status: TaskStatus;
  blockedReason?: 'dependencies' | 'approval' | 'policy' | 'capacity';
  dependsOnTaskIds: ProductionId[];
  inputAssetIds: ProductionId[];
  outputAssetIds: ProductionId[];
  shotId?: ProductionId;
  providerPreference?: string[];
  selectedProvider?: string;
  attempts: number;
  errorCode?: string;
  errorMessage?: string;
  evidence?: string;
}

export interface ProductionApproval {
  id: ProductionId;
  gate: ApprovalGate;
  status: 'pending' | 'approved' | 'rejected';
  approverId?: ProductionId;
  decidedAt?: string;
  notes?: string;
}

export interface CinematicProduction {
  schema: 'izakhono.cinematic/production-v1';
  id: ProductionId;
  title: string;
  brief: string;
  status: ProductionStatus;
  format: 'film' | 'series' | 'music_video' | 'advert' | 'documentary' | 'social' | 'training' | 'other';
  audience?: string;
  language?: string;
  locale?: string;
  targetRuntimeSeconds?: number;
  characters: CharacterBible[];
  locations: LocationBible[];
  props: PropBible[];
  scenes: Scene[];
  shots: Shot[];
  references: ProductionReference[];
  assets: ProductionAsset[];
  tasks: ProductionTask[];
  approvals: ProductionApproval[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    ownerId: string;
    tags: string[];
    version: number;
  };
  publicLive: false;
}

export interface GraphIssue {
  code: string;
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateProductionGraph(project: CinematicProduction): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const unique = (values: string[], path: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) issues.push({ code: 'DUPLICATE_ID', path, message: `Duplicate ID: ${value}`, severity: 'error' });
      seen.add(value);
    }
  };
  const ids = [
    ...project.characters.map(x => x.id), ...project.locations.map(x => x.id),
    ...project.props.map(x => x.id), ...project.scenes.map(x => x.id),
    ...project.shots.map(x => x.id), ...project.references.map(x => x.id),
    ...project.assets.map(x => x.id), ...project.tasks.map(x => x.id),
    ...project.approvals.map(x => x.id),
  ];
  unique(ids, 'project');
  const characterIds = new Set(project.characters.map(x => x.id));
  const locationIds = new Set(project.locations.map(x => x.id));
  const propIds = new Set(project.props.map(x => x.id));
  const sceneIds = new Set(project.scenes.map(x => x.id));
  const shotIds = new Set(project.shots.map(x => x.id));
  const referenceIds = new Set(project.references.map(x => x.id));
  const assetIds = new Set(project.assets.map(x => x.id));
  const taskIds = new Set(project.tasks.map(x => x.id));
  const requireRefs = (values: string[], allowed: Set<string>, path: string, label: string) => {
    for (const value of values) if (!allowed.has(value)) issues.push({ code: 'BROKEN_REFERENCE', path, message: `Unknown ${label}: ${value}`, severity: 'error' });
  };

  for (const scene of project.scenes) {
    if (!locationIds.has(scene.locationId)) issues.push({ code: 'UNKNOWN_LOCATION', path: `scenes.${scene.id}.locationId`, message: 'Scene references a location that does not exist.', severity: 'error' });
    requireRefs(scene.characterIds, characterIds, `scenes.${scene.id}.characterIds`, 'character');
    requireRefs(scene.propIds, propIds, `scenes.${scene.id}.propIds`, 'prop');
    if (scene.estimatedDurationSeconds <= 0) issues.push({ code: 'INVALID_DURATION', path: `scenes.${scene.id}`, message: 'Scene duration must be positive.', severity: 'error' });
  }
  for (const shot of project.shots) {
    if (!sceneIds.has(shot.sceneId)) issues.push({ code: 'UNKNOWN_SCENE', path: `shots.${shot.id}.sceneId`, message: 'Shot references a scene that does not exist.', severity: 'error' });
    requireRefs(shot.characterIds, characterIds, `shots.${shot.id}.characterIds`, 'character');
    requireRefs(shot.propIds, propIds, `shots.${shot.id}.propIds`, 'prop');
    requireRefs(shot.referenceIds, referenceIds, `shots.${shot.id}.referenceIds`, 'reference');
    requireRefs(shot.dependsOnShotIds, shotIds, `shots.${shot.id}.dependsOnShotIds`, 'shot');
    if (shot.durationSeconds <= 0) issues.push({ code: 'INVALID_DURATION', path: `shots.${shot.id}`, message: 'Shot duration must be positive.', severity: 'error' });
    if (shot.dependsOnShotIds.includes(shot.id)) issues.push({ code: 'SELF_DEPENDENCY', path: `shots.${shot.id}`, message: 'A shot cannot depend on itself.', severity: 'error' });
  }
  for (const ref of project.references) requireRefs([ref.assetId], assetIds, `references.${ref.id}.assetId`, 'asset');
  for (const asset of project.assets) requireRefs(asset.parentAssetIds, assetIds, `assets.${asset.id}.parentAssetIds`, 'parent asset');
  for (const task of project.tasks) {
    requireRefs(task.dependsOnTaskIds, taskIds, `tasks.${task.id}.dependsOnTaskIds`, 'task');
    requireRefs(task.inputAssetIds, assetIds, `tasks.${task.id}.inputAssetIds`, 'input asset');
    requireRefs(task.outputAssetIds, assetIds, `tasks.${task.id}.outputAssetIds`, 'output asset');
    if (task.attempts < 0) issues.push({ code: 'INVALID_ATTEMPTS', path: `tasks.${task.id}.attempts`, message: 'Task attempts cannot be negative.', severity: 'error' });
    if (task.status === 'completed' && !task.evidence) issues.push({ code: 'MISSING_COMPLETION_EVIDENCE', path: `tasks.${task.id}`, message: 'Completed tasks require evidence.', severity: 'error' });
    if (task.status === 'submitted' && !task.selectedProvider) issues.push({ code: 'MISSING_PROVIDER', path: `tasks.${task.id}`, message: 'Submitted tasks must identify the selected provider.', severity: 'error' });
  }

  const detectCycle = (nodes: Array<{ id: string; dependencies: string[] }>, path: string) => {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): boolean => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      for (const dep of byId.get(id)?.dependencies ?? []) if (byId.has(dep) && visit(dep)) return true;
      visiting.delete(id);
      visited.add(id);
      return false;
    };
    for (const node of nodes) if (visit(node.id)) {
      issues.push({ code: 'DEPENDENCY_CYCLE', path, message: 'Dependency graph contains a cycle.', severity: 'error' });
      break;
    }
  };
  detectCycle(project.shots.map(x => ({ id: x.id, dependencies: x.dependsOnShotIds })), 'shots');
  detectCycle(project.tasks.map(x => ({ id: x.id, dependencies: x.dependsOnTaskIds })), 'tasks');

  if (project.publicLive !== false) issues.push({ code: 'PUBLIC_BY_DEFAULT', path: 'publicLive', message: 'Productions must remain private until explicitly published through an approved workflow.', severity: 'error' });
  if (!project.approvals.some(x => x.gate === 'creative')) issues.push({ code: 'MISSING_CREATIVE_GATE', path: 'approvals', message: 'A creative approval gate is required.', severity: 'error' });
  if (!project.approvals.some(x => x.gate === 'generation')) issues.push({ code: 'MISSING_GENERATION_GATE', path: 'approvals', message: 'A generation approval gate is required.', severity: 'error' });
  if (!project.approvals.some(x => x.gate === 'master')) issues.push({ code: 'MISSING_MASTER_GATE', path: 'approvals', message: 'A master approval gate is required.', severity: 'error' });
  if (!project.approvals.some(x => x.gate === 'distribution')) issues.push({ code: 'MISSING_DISTRIBUTION_GATE', path: 'approvals', message: 'A distribution approval gate is required.', severity: 'error' });
  return issues;
}

export function getRunnableTasks(project: CinematicProduction): ProductionTask[] {
  const completed = new Set(project.tasks.filter(x => x.status === 'completed').map(x => x.id));
  return project.tasks
    .filter(task => {
      const dependenciesSatisfied = task.dependsOnTaskIds.every(id => completed.has(id));
      const executableStatus = task.status === 'ready' || task.status === 'approved';
      const dependencyBlockReleased = task.status === 'blocked' && task.blockedReason === 'dependencies';
      return dependenciesSatisfied && (executableStatus || dependencyBlockReleased);
    })
    .map(task => task.status === 'blocked' ? { ...task, status: 'ready' as const, blockedReason: undefined } : task);
}

export function updateTaskWithEvidence(
  project: CinematicProduction,
  taskId: string,
  update: Pick<ProductionTask, 'status'> & { evidence?: string; selectedProvider?: string; errorCode?: string; errorMessage?: string },
): CinematicProduction {
  const task = project.tasks.find(x => x.id === taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  if (update.status === 'completed' && !update.evidence?.trim()) throw new Error('Completion requires evidence.');
  if (update.status === 'submitted' && !update.selectedProvider?.trim()) throw new Error('Submission requires a selected provider.');
  return {
    ...project,
    tasks: project.tasks.map(item => item.id === taskId ? { ...item, ...update } : item),
    metadata: { ...project.metadata, updatedAt: new Date().toISOString(), version: project.metadata.version + 1 },
  };
}
