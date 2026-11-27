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
export type AssetRole = 'source' | 'reference' | 'shot_video' | 'shot_audio' | 'voiceover' | 'music' | 'sound_effect' | 'caption' | 'master' | 'distribution_export' | 'thumbnail' | 'other';
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

export interface HumanMediaReviewEvidence {
  schema: 'izakhono.creator/human-media-review-v1';
  profileId: string;
  reviewId: ProductionId;
  assetContentHash: string;
  passed: boolean;
  recordedAt: string;
  recordedBy: string;
  checks: Array<{ id: string; passed: boolean; finding: string }>;
}

export interface MediaQaEvidence {
  schema: 'izakhono.creator/media-qa-evidence-v1';
  profileId: string;
  passed: boolean;
  assetContentHash: string;
  recordedAt: string;
  recordedBy: string;
  checks: Array<{ id: string; passed: boolean; actual: string; expected: string }>;
}

export interface SourceMediaEvidence {
  schema: 'izakhono.creator/source-media-evidence-v1';
  origin: 'user_upload';
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  receivedAt: string;
  receivedBy: string;
  licenceDeclaration: string;
  rightsReviewStatus: 'unverified' | 'verified' | 'rejected';
  consentStatus: 'provided' | 'not_applicable' | 'unverified';
}

export interface SourceRightsReviewEvidence {
  schema: 'izakhono.creator/source-rights-review-v1';
  reviewId: ProductionId;
  assetContentHash: string;
  decision: 'verified' | 'rejected';
  basis: string;
  evidenceReferences: string[];
  recordedAt: string;
  recordedBy: string;
}

export interface ProductionAsset {
  id: ProductionId;
  kind: MediaKind;
  status: TaskStatus;
  source: 'user' | 'owned_model' | 'external_provider' | 'edited' | 'assembled';
  /** Optional production-graph ownership links for shot-to-media traceability. */
  role?: AssetRole;
  sceneId?: ProductionId;
  shotId?: ProductionId;
  createdByTaskId?: ProductionId;
  storageKey?: string;
  contentHash?: string;
  mimeType?: string;
  /** Immutable intake evidence for original user-supplied source media. */
  sourceEvidence?: SourceMediaEvidence;
  /** Append-only, hash-bound rights-review decisions for original source media. */
  rightsReviews?: SourceRightsReviewEvidence[];
  /** Machine QA evidence bound to the exact exported bytes by SHA-256. */
  mediaQa?: MediaQaEvidence;
  /** Append-only human review history for the final distribution export. */
  humanReviews?: HumanMediaReviewEvidence[];
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
  externalJobId?: string;
  pollingToken?: string;
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
    tenantId?: string;
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
  for (const asset of project.assets) {
    requireRefs(asset.parentAssetIds, assetIds, `assets.${asset.id}.parentAssetIds`, 'parent asset');
    if (asset.sourceEvidence) {
      const evidence = asset.sourceEvidence;
      if (asset.role !== 'source' || evidence.schema !== 'izakhono.creator/source-media-evidence-v1' || evidence.origin !== 'user_upload') {
        issues.push({ code: 'INVALID_SOURCE_EVIDENCE', path: `assets.${asset.id}.sourceEvidence`, message: 'Source intake evidence must belong to a user-uploaded source asset.', severity: 'error' });
      }
      if (typeof asset.storageKey !== 'string' || !asset.storageKey.startsWith(`projects/${project.id}/source/`) || asset.status !== 'completed') {
        issues.push({ code: 'SOURCE_MEDIA_NOT_STORED', path: `assets.${asset.id}`, message: 'Ingested source media must be stored under its project source namespace before it is marked completed.', severity: 'error' });
      }
      if (typeof asset.contentHash !== 'string' || !/^[a-f0-9]{64}$/i.test(asset.contentHash) || typeof evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(evidence.sha256) || evidence.sha256.toLowerCase() !== asset.contentHash.toLowerCase()) {
        issues.push({ code: 'SOURCE_HASH_MISMATCH', path: `assets.${asset.id}.sourceEvidence.sha256`, message: 'Source intake SHA-256 must match the asset content hash.', severity: 'error' });
      }
      if (!Number.isSafeInteger(evidence.byteSize) || evidence.byteSize < 1 || typeof evidence.mimeType !== 'string' || evidence.mimeType !== asset.mimeType || typeof evidence.originalFilename !== 'string' || !evidence.originalFilename.trim() || typeof evidence.receivedBy !== 'string' || !evidence.receivedBy.trim() || typeof evidence.licenceDeclaration !== 'string' || !evidence.licenceDeclaration.trim() || typeof evidence.receivedAt !== 'string' || !Number.isFinite(Date.parse(evidence.receivedAt))) {
        issues.push({ code: 'INCOMPLETE_SOURCE_EVIDENCE', path: `assets.${asset.id}.sourceEvidence`, message: 'Source intake evidence requires valid size, MIME type, filename, uploader, licence declaration and timestamp.', severity: 'error' });
      }
      if (evidence.consentStatus === 'provided' && asset.provenance.consentRecordIds.length === 0) {
        issues.push({ code: 'MISSING_SOURCE_CONSENT_RECORDS', path: `assets.${asset.id}.provenance.consentRecordIds`, message: 'Provided source consent must reference at least one consent record.', severity: 'error' });
      }
    }
    if (asset.sceneId && !sceneIds.has(asset.sceneId)) issues.push({ code: 'UNKNOWN_ASSET_SCENE', path: `assets.${asset.id}.sceneId`, message: 'Asset references a scene that does not exist.', severity: 'error' });
    if (asset.shotId && !shotIds.has(asset.shotId)) issues.push({ code: 'UNKNOWN_ASSET_SHOT', path: `assets.${asset.id}.shotId`, message: 'Asset references a shot that does not exist.', severity: 'error' });
    if (asset.shotId && asset.sceneId && project.shots.some(shot => shot.id === asset.shotId && shot.sceneId !== asset.sceneId)) issues.push({ code: 'ASSET_SCENE_SHOT_MISMATCH', path: `assets.${asset.id}`, message: 'Asset sceneId must match the scene that owns its shotId.', severity: 'error' });
    if (asset.createdByTaskId && !taskIds.has(asset.createdByTaskId)) issues.push({ code: 'UNKNOWN_ASSET_TASK', path: `assets.${asset.id}.createdByTaskId`, message: 'Asset references a task that does not exist.', severity: 'error' });
    if (asset.createdByTaskId && project.tasks.some(task => task.id === asset.createdByTaskId && !task.outputAssetIds.includes(asset.id))) issues.push({ code: 'ASSET_TASK_OUTPUT_MISMATCH', path: `assets.${asset.id}.createdByTaskId`, message: 'The creating task must list this asset as an output.', severity: 'error' });
  }
  for (const task of project.tasks) {
    requireRefs(task.dependsOnTaskIds, taskIds, `tasks.${task.id}.dependsOnTaskIds`, 'task');
    requireRefs(task.inputAssetIds, assetIds, `tasks.${task.id}.inputAssetIds`, 'input asset');
    requireRefs(task.outputAssetIds, assetIds, `tasks.${task.id}.outputAssetIds`, 'output asset');
    if (task.shotId && !shotIds.has(task.shotId)) issues.push({ code: 'UNKNOWN_TASK_SHOT', path: `tasks.${task.id}.shotId`, message: 'Task references a shot that does not exist.', severity: 'error' });
    for (const assetId of task.outputAssetIds) {
      const asset = project.assets.find(item => item.id === assetId);
      if (asset?.createdByTaskId && asset.createdByTaskId !== task.id) issues.push({ code: 'TASK_ASSET_CREATOR_MISMATCH', path: `tasks.${task.id}.outputAssetIds`, message: `Asset ${assetId} identifies a different creating task.`, severity: 'error' });
    }
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


const requiredMediaQaCheckIds = [
  'container-mp4', 'duration-positive', 'video-stream-present', 'video-stream-count',
  'video-h264', 'video-dimensions', 'video-pixel-format', 'video-frame-rate',
  'audio-stream-present', 'audio-stream-count', 'audio-aac', 'audio-sample-rate',
  'audio-stereo', 'mp4-fast-start',
];

/**
 * Attach machine QA evidence to the exact stored distribution-export asset.
 * Failed QA is retained for audit; it can never be promoted to a passing record
 * unless all required checks pass for the asset's current SHA-256.
 */
export function recordMediaQaEvidence(
  project: CinematicProduction,
  assetId: ProductionId,
  evidence: MediaQaEvidence,
): CinematicProduction {
  const asset = project.assets.find(item => item.id === assetId);
  if (!asset) throw new Error(`Unknown media QA asset: ${assetId}`);
  if (asset.kind !== 'video' || asset.role !== 'distribution_export') {
    throw new Error('Media QA evidence can only be recorded against a video distribution export.');
  }
  const passedEvidenceRequiresStoredAsset = evidence.passed && asset.status === 'completed' && Boolean(asset.storageKey?.trim());
  const failedEvidenceCanBeRetainedLocally = !evidence.passed && asset.status === 'failed';
  if (!passedEvidenceRequiresStoredAsset && !failedEvidenceCanBeRetainedLocally) {
    throw new Error('Passing QA requires a completed stored export; failed QA may be retained on a failed export record.');
  }
  if (!asset.contentHash || !/^[a-f0-9]{64}$/i.test(asset.contentHash)) {
    throw new Error('Distribution export must have a SHA-256 content hash before QA evidence is recorded.');
  }
  if (evidence.schema !== 'izakhono.creator/media-qa-evidence-v1') throw new Error('Unsupported media QA evidence schema.');
  if (evidence.profileId !== 'facebook-reels-1080x1920-v1') throw new Error('Unsupported distribution profile for this QA record.');
  if (evidence.assetContentHash.toLowerCase() !== asset.contentHash.toLowerCase()) {
    throw new Error('Media QA evidence hash does not match the current distribution asset bytes.');
  }
  if (!evidence.recordedBy.trim() || !Number.isFinite(Date.parse(evidence.recordedAt))) {
    throw new Error('Media QA evidence requires a worker identity and valid timestamp.');
  }
  if (!Array.isArray(evidence.checks)) throw new Error('Media QA checks must be an array.');
  const checks = new Map(evidence.checks.map(check => [check.id, check]));
  if (checks.size !== evidence.checks.length || !requiredMediaQaCheckIds.every(id => checks.has(id)) || evidence.checks.some(check => !check.id?.trim() || !check.actual?.trim() || !check.expected?.trim())) {
    throw new Error('Media QA evidence must contain every required Facebook profile check exactly once with actual and expected values.');
  }
  const checksPassed = evidence.checks.every(check => check.passed === true);
  if (evidence.passed !== checksPassed) throw new Error('Media QA overall result must agree with all recorded checks.');
  return {
    ...project,
    assets: project.assets.map(item => item.id === assetId ? { ...item, mediaQa: { ...evidence, assetContentHash: evidence.assetContentHash.toLowerCase(), checks: evidence.checks.map(check => ({ ...check })) } } : item),
    metadata: { ...project.metadata, updatedAt: evidence.recordedAt, version: project.metadata.version + 1 },
  };
}


const requiredHumanMediaReviewCheckIds = [
  'full-playback-integrity',
  'dialogue-music-effects',
  'captions-safe-areas',
  'continuity-titles-credits',
  'private-upload-playback',
] as const;

export function hasPassingHumanMediaReview(asset: ProductionAsset): boolean {
  const latest = asset.humanReviews?.at(-1);
  if (!latest || !latest.passed || latest.schema !== 'izakhono.creator/human-media-review-v1'
    || !latest.recordedBy.trim() || !Number.isFinite(Date.parse(latest.recordedAt))
    || latest.profileId !== 'facebook-reels-1080x1920-v1'
    || !asset.contentHash || latest.assetContentHash.toLowerCase() !== asset.contentHash.toLowerCase()
    || !Array.isArray(latest.checks)) return false;
  const checks = new Map(latest.checks.map(check => [check.id, check]));
  return checks.size === requiredHumanMediaReviewCheckIds.length
    && requiredHumanMediaReviewCheckIds.every(id => checks.get(id)?.passed === true && Boolean(checks.get(id)?.finding.trim()));
}

/** Append a human review to the immutable review history for a machine-QA-passed export. */
/** Append a rights decision for original source media, bound to its exact stored bytes. */
export function recordSourceRightsReview(
  project: CinematicProduction,
  assetId: ProductionId,
  evidence: SourceRightsReviewEvidence,
): CinematicProduction {
  const asset = project.assets.find(item => item.id === assetId);
  if (!asset || asset.role !== 'source' || !asset.sourceEvidence || asset.status !== 'completed'
    || !asset.storageKey?.startsWith(`projects/${project.id}/source/`)) {
    throw new Error('Rights review can only be recorded against a completed, stored original source-media asset.');
  }
  if (!asset.contentHash || !/^[a-f0-9]{64}$/i.test(asset.contentHash)
    || evidence.assetContentHash.toLowerCase() !== asset.contentHash.toLowerCase()) {
    throw new Error('Rights review must be bound to the exact current source-media SHA-256.');
  }
  if (evidence.schema !== 'izakhono.creator/source-rights-review-v1'
    || !['verified', 'rejected'].includes(evidence.decision)) throw new Error('Unsupported source rights-review schema or decision.');
  if (!evidence.reviewId?.trim() || !evidence.recordedBy?.trim()
    || !Number.isFinite(Date.parse(evidence.recordedAt)) || !evidence.basis?.trim()
    || !Array.isArray(evidence.evidenceReferences) || !evidence.evidenceReferences.length
    || evidence.evidenceReferences.some(value => typeof value !== 'string' || !value.trim())
    || new Set(evidence.evidenceReferences).size !== evidence.evidenceReferences.length) {
    throw new Error('Rights review requires a unique ID, reviewer, timestamp, decision basis and distinct evidence references.');
  }
  if (asset.rightsReviews?.some(item => item.reviewId === evidence.reviewId)) throw new Error('Source rights-review ID already exists.');
  const review = { ...evidence, evidenceReferences: [...evidence.evidenceReferences] };
  return {
    ...project,
    assets: project.assets.map(item => item.id === assetId
      ? { ...item, rightsReviews: [...(item.rightsReviews ?? []), review] }
      : item),
    metadata: { ...project.metadata, updatedAt: evidence.recordedAt, version: project.metadata.version + 1 },
  };
}

/** Only the latest hash-matched verified decision clears source-media rights. */
export function hasVerifiedSourceRights(asset: ProductionAsset): boolean {
  if (asset.role !== 'source' || !asset.sourceEvidence || !asset.contentHash
    || !/^[a-f0-9]{64}$/i.test(asset.contentHash)) return false;
  const latest = asset.rightsReviews?.at(-1);
  return Boolean(latest
    && latest.schema === 'izakhono.creator/source-rights-review-v1'
    && latest.decision === 'verified'
    && latest.assetContentHash.toLowerCase() === asset.contentHash.toLowerCase()
    && latest.reviewId.trim() && latest.recordedBy.trim()
    && Number.isFinite(Date.parse(latest.recordedAt))
    && latest.basis.trim() && Array.isArray(latest.evidenceReferences)
    && latest.evidenceReferences.length > 0
    && latest.evidenceReferences.every(value => value.trim()));
}

export function recordHumanMediaReview(
  project: CinematicProduction,
  assetId: ProductionId,
  evidence: HumanMediaReviewEvidence,
): CinematicProduction {
  const asset = project.assets.find(item => item.id === assetId);
  if (!asset || asset.kind !== 'video' || asset.role !== 'distribution_export'
    || asset.status !== 'completed' || !asset.storageKey?.trim()) {
    throw new Error('Human review can only be recorded against a completed, stored video distribution export.');
  }
  if (!asset.contentHash || !/^[a-f0-9]{64}$/i.test(asset.contentHash)
    || !asset.mediaQa?.passed || asset.mediaQa.assetContentHash.toLowerCase() !== asset.contentHash.toLowerCase()) {
    throw new Error('A matching passing machine QA record is required before human review.');
  }
  if (evidence.schema !== 'izakhono.creator/human-media-review-v1'
    || evidence.profileId !== 'facebook-reels-1080x1920-v1') throw new Error('Unsupported human media review schema or profile.');
  if (evidence.assetContentHash.toLowerCase() !== asset.contentHash!.toLowerCase()) throw new Error('Human review evidence must be bound to the exact current export SHA-256.');
  if (!evidence.reviewId.trim() || !evidence.recordedBy.trim() || !Number.isFinite(Date.parse(evidence.recordedAt))) {
    throw new Error('Human review requires a review ID, reviewer identity and valid timestamp.');
  }
  if (asset.humanReviews?.some(item => item.reviewId === evidence.reviewId)) throw new Error('Human review ID already exists for this export.');
  if (!Array.isArray(evidence.checks)) throw new Error('Human review checks must be an array.');
  const checks = new Map(evidence.checks.map(check => [check.id, check]));
  if (checks.size !== evidence.checks.length
    || checks.size !== requiredHumanMediaReviewCheckIds.length
    || !requiredHumanMediaReviewCheckIds.every(id => checks.has(id))
    || evidence.checks.some(check => !check.id?.trim() || !check.finding?.trim())) {
    throw new Error('Human review must contain every required playback, audio, captions, continuity and private-upload check exactly once with findings.');
  }
  const checksPassed = evidence.checks.every(check => check.passed === true);
  if (evidence.passed !== checksPassed) throw new Error('Human review overall result must agree with all recorded checks.');
  return {
    ...project,
    assets: project.assets.map(item => item.id === assetId
      ? { ...item, humanReviews: [...(item.humanReviews ?? []), { ...evidence, checks: evidence.checks.map(check => ({ ...check })) }] }
      : item),
    metadata: { ...project.metadata, updatedAt: evidence.recordedAt, version: project.metadata.version + 1 },
  };
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
  update: Pick<ProductionTask, 'status'> & { evidence?: string; selectedProvider?: string; externalJobId?: string; pollingToken?: string; errorCode?: string; errorMessage?: string },
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
