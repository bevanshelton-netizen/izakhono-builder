import { compileCinematicBrief, type CinematicBriefInput } from './cinematic-brief-compiler';
import {
  getRunnableTasks,
  updateTaskWithEvidence,
  validateProductionGraph,
  type ApprovalGate,
  type CinematicProduction,
  type ProductionTask,
} from './cinematic-production-graph';
import { getProject, listProjects, saveProject, type CreatorStorageEnv } from './project-store';

type CinematicEnv = CreatorStorageEnv & { CREATOR_GENERATION_SECRET?: string };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const gates: ApprovalGate[] = ['creative', 'generation', 'master', 'distribution'];
const parseBody = async (request: Request) => request.json().catch(() => null) as Promise<Record<string, unknown> | null>;
const authenticated = (request: Request, env: CinematicEnv) =>
  Boolean(env.CREATOR_GENERATION_SECRET) &&
  request.headers.get('x-creator-generation-secret') === env.CREATOR_GENERATION_SECRET;

function graphFrom(project: Awaited<ReturnType<typeof getProject>>): CinematicProduction | null {
  if (!project || !project.packageData || typeof project.packageData !== 'object') return null;
  const graph = (project.packageData as Record<string, unknown>).cinematicProduction;
  return graph && typeof graph === 'object' ? graph as CinematicProduction : null;
}
function validate(graph: CinematicProduction) {
  const issues = validateProductionGraph(graph);
  return { issues, valid: !issues.some(issue => issue.severity === 'error') };
}

/** Handles the cinematic API namespace while reusing Creator's canonical project, asset and render stores. */
export async function handleCinematicApi(request: Request, env: CinematicEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/cinematic/')) return null;
  if (!authenticated(request, env)) return response({ error: 'Cinematic API requires configured server-side CREATOR_GENERATION_SECRET authentication.' }, env.CREATOR_GENERATION_SECRET ? 401 : 503);
  if (!env.DB) return response({ error: 'Creator D1 storage is not configured.' }, 503);

  if (url.pathname === '/api/cinematic/projects' && request.method === 'GET') {
    const projects = await listProjects(env, 100);
    return response({ projects: projects.map(project => ({
      id: project.id, brief: project.brief, createdAt: project.createdAt, updatedAt: project.updatedAt,
      production: graphFrom(project),
    })).filter(project => project.production) });
  }

  if (url.pathname === '/api/cinematic/projects' && request.method === 'POST') {
    const body = await parseBody(request);
    if (!body || typeof body.brief !== 'string' || !body.brief.trim() || typeof body.ownerId !== 'string' || !body.ownerId.trim()) {
      return response({ error: 'brief and ownerId are required.' }, 400);
    }
    const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `cin_${crypto.randomUUID()}`;
    if (await getProject(env, id)) return response({ error: 'project id already exists.' }, 409);
    const input: CinematicBriefInput = {
      id, ownerId: body.ownerId.trim(), brief: body.brief.trim(),
      ...(typeof body.title === 'string' ? { title: body.title } : {}),
      ...(typeof body.format === 'string' ? { format: body.format as CinematicBriefInput['format'] } : {}),
      ...(typeof body.audience === 'string' ? { audience: body.audience } : {}),
      ...(typeof body.language === 'string' ? { language: body.language } : {}),
      ...(typeof body.locale === 'string' ? { locale: body.locale } : {}),
      ...(typeof body.targetRuntimeSeconds === 'number' ? { targetRuntimeSeconds: body.targetRuntimeSeconds } : {}),
      ...(typeof body.aspectRatio === 'string' ? { aspectRatio: body.aspectRatio as CinematicBriefInput['aspectRatio'] } : {}),
    };
    const compiled = compileCinematicBrief(input);
    const checked = validate(compiled.production);
    if (!checked.valid) return response({ error: 'Compiled production failed graph validation.', issues: checked.issues }, 422);
    const project = await saveProject(env, {
      id, brief: input.brief,
      packageData: { cinematicProduction: compiled.production, cinematic: { assumptions: compiled.assumptions, nextActions: compiled.nextActions } },
    });
    return response({ status: 'created', project: { id: project.id, brief: project.brief, production: compiled.production, assumptions: compiled.assumptions, nextActions: compiled.nextActions }, validation: checked }, 201);
  }

  const match = url.pathname.match(/^\/api\/cinematic\/projects\/([^/]+)(?:\/(approvals|tasks)\/([^/]+))?$/);
  if (!match) return response({ error: 'Unknown cinematic API route.' }, 404);
  const [, rawId, resource, rawResourceId] = match;
  const id = decodeURIComponent(rawId);
  const project = await getProject(env, id);
  if (!project) return response({ error: 'project not found.' }, 404);
  const graph = graphFrom(project);
  if (!graph) return response({ error: 'project has no cinematic production graph.' }, 409);

  if (!resource && request.method === 'GET') {
    const assets = (project.packageData as Record<string, unknown>).cinematic;
    return response({ project: { id: project.id, brief: project.brief, createdAt: project.createdAt, updatedAt: project.updatedAt }, production: graph, ...(assets && typeof assets === 'object' ? assets : {}), runnableTasks: getRunnableTasks(graph), validation: validate(graph) });
  }

  if (!resource && request.method === 'PATCH') {
    const body = await parseBody(request);
    const candidate = body?.production as CinematicProduction | undefined;
    if (!candidate || candidate.id !== id || candidate.metadata?.ownerId !== graph.metadata.ownerId) return response({ error: 'A production graph with the same project and immutable owner is required.' }, 400);
    const checked = validate(candidate);
    if (!checked.valid) return response({ error: 'Production graph validation failed.', issues: checked.issues }, 422);
    const updated = { ...candidate, metadata: { ...candidate.metadata, updatedAt: new Date().toISOString(), version: graph.metadata.version + 1 } };
    await saveProject(env, { id, brief: updated.brief, packageData: { ...(project.packageData as Record<string, unknown>), cinematicProduction: updated } });
    return response({ status: 'updated', production: updated, validation: validate(updated) });
  }

  if (resource === 'approvals' && request.method === 'POST') {
    const gate = rawResourceId as ApprovalGate;
    if (!gates.includes(gate)) return response({ error: 'unknown approval gate.' }, 400);
    const body = await parseBody(request);
    if (!body || typeof body.approverId !== 'string' || !body.approverId.trim() || !['approved', 'rejected'].includes(String(body.decision))) {
      return response({ error: 'approverId and decision (approved|rejected) are required.' }, 400);
    }
    const approval = graph.approvals.find(item => item.gate === gate);
    if (!approval) return response({ error: 'approval gate missing from production.' }, 409);
    if (approval.status !== 'pending') return response({ error: 'approval has already been decided.' }, 409);
    const updated: CinematicProduction = {
      ...graph,
      approvals: graph.approvals.map(item => item.gate === gate ? {
        ...item, status: body.decision as 'approved' | 'rejected', approverId: (body.approverId as string).trim(),
        decidedAt: new Date().toISOString(), ...(typeof body.notes === 'string' ? { notes: body.notes.slice(0, 2000) } : {}),
      } : item),
      metadata: { ...graph.metadata, updatedAt: new Date().toISOString(), version: graph.metadata.version + 1 },
    };
    await saveProject(env, { id, brief: updated.brief, packageData: { ...(project.packageData as Record<string, unknown>), cinematicProduction: updated } });
    return response({ status: 'decided', approval: updated.approvals.find(item => item.gate === gate), productionVersion: updated.metadata.version });
  }

  if (resource === 'tasks' && request.method === 'PATCH') {
    const body = await parseBody(request);
    if (!body || !['ready', 'approved', 'submitted', 'processing', 'completed', 'failed', 'cancelled'].includes(String(body.status))) return response({ error: 'valid task status is required.' }, 400);
    const current = graph.tasks.find(task => task.id === rawResourceId);
    if (!current) return response({ error: 'task not found.' }, 404);
    if (body.status === 'submitted' && typeof body.selectedProvider !== 'string') return response({ error: 'selectedProvider is required for submission.' }, 400);
    try {
      const update: Pick<ProductionTask, 'status'> & { evidence?: string; selectedProvider?: string; errorCode?: string; errorMessage?: string } = {
        status: body.status as ProductionTask['status'],
        ...(typeof body.evidence === 'string' ? { evidence: body.evidence } : {}),
        ...(typeof body.selectedProvider === 'string' ? { selectedProvider: body.selectedProvider } : {}),
        ...(typeof body.errorCode === 'string' ? { errorCode: body.errorCode } : {}),
        ...(typeof body.errorMessage === 'string' ? { errorMessage: body.errorMessage } : {}),
      };
      const updated = updateTaskWithEvidence(graph, rawResourceId, update);
      const checked = validate(updated);
      if (!checked.valid) return response({ error: 'Task update violates production graph rules.', issues: checked.issues }, 422);
      await saveProject(env, { id, brief: updated.brief, packageData: { ...(project.packageData as Record<string, unknown>), cinematicProduction: updated } });
      return response({ status: 'updated', task: updated.tasks.find(task => task.id === rawResourceId), runnableTasks: getRunnableTasks(updated), productionVersion: updated.metadata.version });
    } catch (error) {
      return response({ error: error instanceof Error ? error.message : 'Task update failed.' }, 400);
    }
  }
  return response({ error: 'Method not allowed.' }, 405);
}
