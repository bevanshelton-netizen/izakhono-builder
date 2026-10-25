export type WorkflowStageId =
  | 'brief'
  | 'writing'
  | 'voice'
  | 'music'
  | 'visuals'
  | 'video'
  | 'code'
  | 'distribution';

export type WorkflowArtifactKind =
  | 'brief'
  | 'script'
  | 'storyboard'
  | 'voice'
  | 'music'
  | 'image'
  | 'video'
  | 'code'
  | 'caption'
  | 'thumbnail'
  | 'delivery-package';

export type WorkflowArtifactStatus = 'planned' | 'approved' | 'submitted' | 'completed' | 'failed';

export type OneWorkflowBrief = {
  id: string;
  instruction: string;
  audience?: string;
  language?: string;
  locale?: string;
  channels?: string[];
  requestedOutputs?: WorkflowArtifactKind[];
};

export type OneWorkflowArtifact = {
  id: string;
  kind: WorkflowArtifactKind;
  stage: WorkflowStageId;
  status: WorkflowArtifactStatus;
  dependsOn: string[];
  provider?: string;
  evidence?: string;
  metadata?: Record<string, unknown>;
};

export type OneWorkflowPlan = {
  schema: 'izakhono.one/workflow-v1';
  workflowId: string;
  title: string;
  brief: OneWorkflowBrief;
  stages: Array<{
    id: WorkflowStageId;
    status: 'ready' | 'gated';
    purpose: string;
  }>;
  artifacts: OneWorkflowArtifact[];
  approvalGates: Array<'creative' | 'generation' | 'master' | 'distribution'>;
  publicLive: false;
};

const id = (prefix: string) => `one_${prefix}_${crypto.randomUUID()}`;

function includesAny(value: string, terms: string[]) {
  return terms.some(term => value.includes(term));
}

/**
 * Converts one natural-language instruction into a single dependency graph.
 * Providers may change, but the IZAKHONO ONE workflow contract remains stable.
 */
export function planOneWorkflow(input: OneWorkflowBrief): OneWorkflowPlan {
  const instruction = input.instruction.trim();
  const lower = instruction.toLowerCase();
  const wantsVideo = includesAny(lower, ['video', 'film', 'reel', 'short', 'music video', 'advert']);
  const wantsMusic = includesAny(lower, ['music', 'song', 'single', 'beat', 'amapiano', 'afrobeats']);
  const wantsVoice = includesAny(lower, ['voice', 'voiceover', 'narration', 'podcast']);
  const wantsCode = includesAny(lower, ['website', 'landing page', 'web app', 'app', 'software', 'code', 'dashboard']);
  const wantsSocial = includesAny(lower, ['social', 'tiktok', 'instagram', 'reels', 'shorts']);

  const artifacts: OneWorkflowArtifact[] = [];
  const add = (kind: WorkflowArtifactKind, stage: WorkflowStageId, dependsOn: string[] = [], metadata?: Record<string, unknown>) => {
    const artifact = { id: id(kind), kind, stage, status: 'planned' as const, dependsOn, metadata };
    artifacts.push(artifact);
    return artifact.id;
  };

  const briefId = add('brief', 'brief');
  const scriptId = add('script', 'writing', [briefId]);
  const storyboardId = wantsVideo ? add('storyboard', 'writing', [scriptId]) : undefined;
  const voiceId = wantsVoice || wantsVideo ? add('voice', 'voice', [scriptId]) : undefined;
  const musicId = wantsMusic || wantsVideo ? add('music', 'music', [briefId, scriptId]) : undefined;
  const imageId = wantsVideo ? add('image', 'visuals', [storyboardId!]) : undefined;
  const videoId = wantsVideo
    ? add('video', 'video', [storyboardId!, ...(voiceId ? [voiceId] : []), ...(musicId ? [musicId] : []), ...(imageId ? [imageId] : [])])
    : undefined;
  const codeId = wantsCode ? add('code', 'code', [briefId, scriptId], { productBuild: true }) : undefined;
  const captionId = wantsSocial ? add('caption', 'distribution', [scriptId, ...(videoId ? [videoId] : [])]) : undefined;
  const thumbnailId = wantsVideo ? add('thumbnail', 'distribution', [videoId ?? storyboardId!]) : undefined;
  add('delivery-package', 'distribution', [
    ...(videoId ? [videoId] : []),
    ...(codeId ? [codeId] : []),
    ...(captionId ? [captionId] : []),
    ...(thumbnailId ? [thumbnailId] : []),
    ...(voiceId ? [voiceId] : []),
    ...(musicId ? [musicId] : []),
  ]);

  const stages: OneWorkflowPlan['stages'] = [
    ['brief', 'ready', 'Normalize the instruction, audience, language, channels and required outputs.'],
    ['writing', 'ready', 'Produce the script, treatment and/or storyboard that all downstream assets reference.'],
    ['voice', voiceId ? 'ready' : 'gated', 'Generate or attach approved narration/voice assets when required.'],
    ['music', musicId ? 'ready' : 'gated', 'Generate or attach approved music assets when required.'],
    ['visuals', imageId ? 'ready' : 'gated', 'Generate visual references and maintain continuity across shots.'],
    ['video', videoId ? 'ready' : 'gated', 'Assemble approved visual, voice and music dependencies into video jobs.'],
    ['code', codeId ? 'ready' : 'gated', 'Generate software artifacts when the instruction requests an application or website.'],
    ['distribution', 'ready', 'Package approved outputs for channels without making anything public automatically.'],
  ].map(([id, status, purpose]) => ({ id: id as WorkflowStageId, status: status as 'ready' | 'gated', purpose }));

  return {
    schema: 'izakhono.one/workflow-v1',
    workflowId: id('workflow'),
    title: wantsVideo ? 'IZAKHONO ONE Creative Production' : wantsCode ? 'IZAKHONO ONE Product Build' : 'IZAKHONO ONE Production',
    brief: input,
    stages,
    artifacts,
    approvalGates: ['creative', 'generation', 'master', 'distribution'],
    publicLive: false,
  };
}

export function nextRunnableArtifacts(plan: OneWorkflowPlan, completedIds: Set<string>): OneWorkflowArtifact[] {
  return plan.artifacts.filter(artifact =>
    artifact.status === 'planned' && artifact.dependsOn.every(dependency => completedIds.has(dependency)),
  );
}

export function markArtifactCompleted(plan: OneWorkflowPlan, artifactId: string, evidence: string): OneWorkflowPlan {
  const artifacts = plan.artifacts.map(artifact =>
    artifact.id === artifactId ? { ...artifact, status: 'completed' as const, evidence } : artifact,
  );
  return { ...plan, artifacts };
}
