import { getProject, listProjects, saveProject, type CreatorStorageEnv } from './project-store';
import { markArtifactCompleted, nextRunnableArtifacts, planOneWorkflow, type OneWorkflowBrief, type OneWorkflowPlan } from './one-workflow';

type OneWorkflowRequest = Partial<Omit<OneWorkflowBrief, 'id'>> & { projectId?: string; id?: string };

type StoredPackage = Record<string, unknown> & { oneWorkflow?: OneWorkflowPlan };

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    },
  });
}

function parseBody(request: Request) {
  return request.json().catch(() => null) as Promise<OneWorkflowRequest | null>;
}

function storedWorkflow(project: Awaited<ReturnType<typeof getProject>>) {
  if (!project || !project.packageData || typeof project.packageData !== 'object') return undefined;
  return (project.packageData as StoredPackage).oneWorkflow;
}

function runnable(plan: OneWorkflowPlan) {
  const completed = new Set(plan.artifacts.filter(artifact => artifact.status === 'completed').map(artifact => artifact.id));
  return nextRunnableArtifacts(plan, completed);
}

export async function handleOneWorkflow(request: Request, env: CreatorStorageEnv, path: string) {
  if (request.method === 'OPTIONS') return response({ ok: true });

  if (request.method === 'POST' && path === '/api/one/workflow') {
    const body = await parseBody(request);
    if (!body?.instruction?.trim()) return response({ error: 'instruction is required' }, 400);
    const projectId = body.projectId?.trim();
    if (projectId && !(await getProject(env, projectId))) return response({ error: 'project not found' }, 404);

    const brief: OneWorkflowBrief = {
      id: body.id?.trim() || `one_brief_${crypto.randomUUID()}`,
      instruction: body.instruction.trim(),
      audience: body.audience?.trim() || undefined,
      language: body.language?.trim() || undefined,
      locale: body.locale?.trim() || undefined,
      channels: Array.isArray(body.channels) ? body.channels.filter(Boolean).slice(0, 20) : undefined,
      requestedOutputs: Array.isArray(body.requestedOutputs) ? body.requestedOutputs : undefined,
    };
    const plan = planOneWorkflow(brief);

    if (projectId) {
      const project = await getProject(env, projectId);
      const packageData: StoredPackage = project?.packageData && typeof project.packageData === 'object'
        ? { ...(project.packageData as Record<string, unknown>) }
        : {};
      packageData.oneWorkflow = plan;
      await saveProject(env, { id: projectId, brief: project?.brief || brief.instruction, packageData });
    }

    return response({ status: 'planned', plan, nextRunnable: runnable(plan), persisted: Boolean(projectId) });
  }

  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'one' || parts[2] !== 'workflow') return response({ error: 'not found' }, 404);
  const workflowId = parts[3];

  if (request.method === 'GET' && workflowId) {
    const projects = await listProjects(env);
    for (const project of projects) {
      const plan = storedWorkflow(project);
      if (plan?.workflowId === workflowId) return response({ status: 'ready', plan, projectId: project.id, nextRunnable: runnable(plan) });
    }
    return response({ error: 'workflow not found' }, 404);
  }

  if (request.method === 'POST' && workflowId === 'complete') {
    return response({ error: 'workflow id is required' }, 400);
  }

  if (request.method === 'POST' && workflowId) {
    const action = parts[4];
    if (action !== 'complete') return response({ error: 'expected /api/one/workflow/:workflowId/complete' }, 400);
    const body = await parseBody(request) as (OneWorkflowRequest & { artifactId?: string; evidence?: string }) | null;
    if (!body?.artifactId?.trim()) return response({ error: 'artifactId is required' }, 400);
    if (!body.evidence?.trim()) return response({ error: 'evidence is required' }, 400);

    let project = body.projectId ? await getProject(env, body.projectId) : undefined;
    if (body.projectId && !project) return response({ error: 'project not found' }, 404);
    if (!project) {
      const projects = await listProjects(env);
      project = projects.find(candidate => storedWorkflow(candidate)?.workflowId === workflowId);
    }
    if (!project) return response({ error: 'workflow not found' }, 404);

    const plan = storedWorkflow(project);
    if (!plan || plan.workflowId !== workflowId) return response({ error: 'workflow not found' }, 404);
    const artifact = plan.artifacts.find(item => item.id === body.artifactId);
    if (!artifact) return response({ error: 'artifact not found' }, 404);
    if (artifact.status === 'completed') return response({ error: 'artifact already completed', plan, nextRunnable: runnable(plan) }, 409);
    if (artifact.dependsOn.some(dependency => !plan.artifacts.some(item => item.id === dependency && item.status === 'completed'))) {
      return response({ error: 'artifact dependencies are not complete', dependsOn: artifact.dependsOn }, 409);
    }

    const updated = markArtifactCompleted(plan, artifact.id, body.evidence.trim());
    const packageData: StoredPackage = project.packageData && typeof project.packageData === 'object'
      ? { ...(project.packageData as Record<string, unknown>), oneWorkflow: updated }
      : { oneWorkflow: updated };
    await saveProject(env, { id: project.id, brief: project.brief, packageData });
    return response({ status: 'completed', plan: updated, artifact: updated.artifacts.find(item => item.id === artifact.id), nextRunnable: runnable(updated) });
  }

  return response({ error: 'not found' }, 404);
}
