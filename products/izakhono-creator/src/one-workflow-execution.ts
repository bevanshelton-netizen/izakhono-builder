import { createAdapters, chooseProvider, type GenerationRequest, type ProviderEnv, type ProviderId } from './provider-router';
import { getProject, findAssetByExternalId, saveAsset, updateAsset, type CreatorStorageEnv } from './project-store';
import type { OneWorkflowArtifact, OneWorkflowPlan } from './one-workflow';

type ExecutionEnv = CreatorStorageEnv & ProviderEnv & { CREATOR_GENERATION_SECRET?: string; CREATOR_GENERATION_ENABLED?: string };
type StoredPackage = Record<string, unknown> & { oneWorkflow?: OneWorkflowPlan };

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } }); }
function authorized(request: Request, env: ExecutionEnv) { return !env.CREATOR_GENERATION_SECRET || request.headers.get('x-creator-generation-secret') === env.CREATOR_GENERATION_SECRET; }
function load(project: Awaited<ReturnType<typeof getProject>>) { return project?.packageData && typeof project.packageData === 'object' ? (project.packageData as StoredPackage).oneWorkflow : undefined; }
async function persist(project: NonNullable<Awaited<ReturnType<typeof getProject>>>, env: ExecutionEnv, plan: OneWorkflowPlan) { const { saveProject } = await import('./project-store'); const packageData = project.packageData && typeof project.packageData === 'object' ? { ...(project.packageData as Record<string, unknown>), oneWorkflow: plan } : { oneWorkflow: plan }; return saveProject(env, { id: project.id, brief: project.brief, packageData }); }
function updateArtifact(plan: OneWorkflowPlan, artifactId: string, patch: Partial<OneWorkflowArtifact>): OneWorkflowPlan { return { ...plan, artifacts: plan.artifacts.map(a => a.id === artifactId ? { ...a, ...patch } : a) }; }
function readyForExecution(plan: OneWorkflowPlan, artifact: OneWorkflowArtifact) { return artifact.status === 'approved' && artifact.dependsOn.every(id => plan.artifacts.some(a => a.id === id && a.status === 'completed')); }
function generationRequest(artifact: OneWorkflowArtifact): GenerationRequest | null { if (artifact.kind !== 'image' && artifact.kind !== 'video') return null; const metadata = artifact.metadata ?? {}; return { kind: artifact.kind, prompt: String(metadata.prompt ?? `Create the approved ${artifact.kind} for IZAKHONO ONE workflow ${artifact.id}.`), aspectRatio: typeof metadata.aspectRatio === 'string' ? metadata.aspectRatio : artifact.kind === 'image' ? '1:1' : '16:9', durationSeconds: typeof metadata.durationSeconds === 'number' ? metadata.durationSeconds : artifact.kind === 'video' ? 5 : undefined, firstFrameUrl: typeof metadata.firstFrameUrl === 'string' ? metadata.firstFrameUrl : undefined, lastFrameUrl: typeof metadata.lastFrameUrl === 'string' ? metadata.lastFrameUrl : undefined }; }

export async function handleOneWorkflowExecution(request: Request, env: ExecutionEnv, path: string) {
  if (request.method === 'OPTIONS') return json({ ok: true });
  const parts = path.split('/').filter(Boolean); if (parts[0] !== 'api' || parts[1] !== 'one' || parts[2] !== 'workflow') return json({ error: 'not found' }, 404);
  const workflowId = parts[3], action = parts[4]; if (!workflowId || !['approve', 'execute', 'poll'].includes(action)) return json({ error: 'expected /api/one/workflow/:workflowId/approve|execute|poll' }, 400);
  if (!authorized(request, env)) return json({ error: 'generation authorization required' }, 401);
  if (action !== 'approve' && env.CREATOR_GENERATION_ENABLED !== 'true') return json({ error: 'Generation is disabled. Configure CREATOR_GENERATION_ENABLED=true after provider and billing review.' }, 403);
  const body = await request.json().catch(() => ({})) as { projectId?: string; artifactId?: string; evidence?: string; provider?: string; externalId?: string };
  if (!body.projectId) return json({ error: 'projectId is required' }, 400); const project = await getProject(env, body.projectId); if (!project) return json({ error: 'project not found' }, 404);
  const plan = load(project); if (!plan || plan.workflowId !== workflowId) return json({ error: 'workflow not found' }, 404);

  if (action === 'approve') {
    if (!body.artifactId) return json({ error: 'artifactId is required' }, 400); const artifact = plan.artifacts.find(a => a.id === body.artifactId); if (!artifact) return json({ error: 'artifact not found' }, 404);
    if (artifact.status !== 'planned') return json({ error: `artifact cannot be approved from ${artifact.status}` }, 409); if (artifact.dependsOn.some(id => !plan.artifacts.some(a => a.id === id && a.status === 'completed'))) return json({ error: 'artifact dependencies are not complete' }, 409);
    const updated = updateArtifact(plan, artifact.id, { status: 'approved', evidence: body.evidence?.trim() || 'Approved by authorized workflow operator.' }); await persist(project, env, updated); return json({ status: 'approved', artifact: updated.artifacts.find(a => a.id === artifact.id), plan: updated });
  }

  if (action === 'execute') {
    if (!body.artifactId) return json({ error: 'artifactId is required' }, 400); const artifact = plan.artifacts.find(a => a.id === body.artifactId); if (!artifact) return json({ error: 'artifact not found' }, 404);
    if (!readyForExecution(plan, artifact)) return json({ error: 'artifact must be approved and all dependencies completed', status: artifact.status }, 409);
    const generation = generationRequest(artifact); if (!generation) return json({ status: 'blocked', reason: 'This artifact requires a specialized text/audio/code/distribution provider; no generic media adapter is invoked.' }, 422);
    const adapter = chooseProvider(generation, createAdapters(env), body.provider ?? env.CREATOR_PROVIDER); if (!adapter) return json({ status: 'blocked', reason: 'No enabled provider supports this approved artifact.' }, 503);
    const job = await adapter.submit(generation); const updated = updateArtifact(plan, artifact.id, { status: job.status === 'failed' ? 'failed' : 'submitted', provider: job.provider, evidence: job.error ? `Provider submission failed: ${job.error}` : `Submitted to ${job.provider}; external job ${job.externalId ?? 'unknown'}.` });
    await persist(project, env, updated); await saveAsset(env, { id: job.id, projectId: project.id, kind: generation.kind, status: job.status === 'failed' ? 'failed' : 'submitted', provider: job.provider, externalId: job.externalId, url: job.outputUrl, metadata: { workflowId, artifactId: artifact.id, request: generation, selected: false } }); return json({ status: job.status === 'failed' ? 'failed' : 'submitted', artifact: updated.artifacts.find(a => a.id === artifact.id), job });
  }

  if (!body.externalId) return json({ error: 'externalId is required' }, 400); const provider = (body.provider ?? env.CREATOR_PROVIDER) as ProviderId | undefined; if (!provider) return json({ error: 'provider is required for polling' }, 400);
  const asset = await findAssetByExternalId(env, provider, body.externalId); if (!asset) return json({ error: 'tracked provider job not found' }, 404); const adapter = createAdapters(env).find(a => a.id === provider); if (!adapter?.enabled) return json({ error: `${provider} is not configured` }, 503);
  const job = await adapter.poll(body.externalId, asset.kind); await updateAsset(env, asset.id, { status: job.status, url: job.outputUrl ?? asset.url, metadata: { ...(asset.metadata as Record<string, unknown> ?? {}), lastPoll: job } });
  const artifactId = String((asset.metadata as Record<string, unknown> | undefined)?.artifactId ?? ''); const currentPlan = load(project); let updatedPlan = currentPlan; if (currentPlan && artifactId && job.status === 'completed') updatedPlan = updateArtifact(currentPlan, artifactId, { status: 'completed', provider, evidence: job.outputUrl ? `Completed by ${provider}; output evidence recorded.` : `Completed by ${provider}.` }); if (updatedPlan && updatedPlan !== currentPlan) await persist(project, env, updatedPlan);
  return json({ status: 'polled', job, assetId: asset.id, plan: updatedPlan });
}
