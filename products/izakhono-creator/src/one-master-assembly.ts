import { getProject, type CreatorStorageEnv } from './project-store';
import type { OneWorkflowArtifact, OneWorkflowPlan } from './one-workflow';

type AssemblyEnv = CreatorStorageEnv;
type StoredPackage = Record<string, unknown> & { oneWorkflow?: OneWorkflowPlan; oneMaster?: OneMasterPackage };

export type OneMasterStatus = 'blocked' | 'ready' | 'approved';
export type OneMasterItem = { artifactId: string; kind: OneWorkflowArtifact['kind']; status: OneWorkflowArtifact['status']; provider?: string; evidence?: string; outputUrl?: string };
export type OneMasterPackage = {
  schema: 'izakhono.one/master-v1'; workflowId: string; status: OneMasterStatus; title: string; createdAt: string;
  items: OneMasterItem[];
  qa: { passed: boolean; checks: Array<{ id: string; passed: boolean; detail: string }> };
  delivery: { manifestReady: boolean; publicLive: false }; approvalRequired: 'master';
};

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } }); }
function packageData(project: Awaited<ReturnType<typeof getProject>>): StoredPackage { return project?.packageData && typeof project.packageData === 'object' ? project.packageData as StoredPackage : {}; }
function outputUrl(artifact: OneWorkflowArtifact): string | undefined { const value = artifact.metadata?.outputUrl; return typeof value === 'string' && value.length > 0 ? value : undefined; }

export function buildMaster(plan: OneWorkflowPlan): OneMasterPackage {
  const items = plan.artifacts.filter(a => a.kind !== 'brief' && a.kind !== 'delivery-package').map(a => ({ artifactId: a.id, kind: a.kind, status: a.status, provider: a.provider, evidence: a.evidence, outputUrl: outputUrl(a) }));
  const required = plan.artifacts.filter(a => a.kind !== 'brief' && a.kind !== 'delivery-package');
  const completed = required.filter(a => a.status === 'completed');
  const checks = [
    { id: 'dependencies-complete', passed: required.every(a => a.status === 'completed'), detail: `${completed.length}/${required.length} production artifacts completed.` },
    { id: 'evidence-present', passed: required.every(a => Boolean(a.evidence)), detail: 'Every production artifact has execution evidence.' },
    { id: 'no-failed-artifacts', passed: required.every(a => a.status !== 'failed'), detail: 'No production artifact is marked failed.' },
    { id: 'delivery-manifest', passed: true, detail: 'Master package manifest can be generated without publishing.' },
  ];
  const passed = checks.every(c => c.passed);
  return { schema: 'izakhono.one/master-v1', workflowId: plan.workflowId, status: passed ? 'ready' : 'blocked', title: `${plan.title} — Master Package`, createdAt: new Date().toISOString(), items, qa: { passed, checks }, delivery: { manifestReady: passed, publicLive: false }, approvalRequired: 'master' };
}

async function persist(project: NonNullable<Awaited<ReturnType<typeof getProject>>>, env: AssemblyEnv, master: OneMasterPackage, plan?: OneWorkflowPlan) {
  const { saveProject } = await import('./project-store');
  const data = packageData(project);
  return saveProject(env, { id: project.id, brief: project.brief, packageData: { ...data, ...(plan ? { oneWorkflow: plan } : {}), oneMaster: master } });
}

export async function handleOneMasterAssembly(request: Request, env: AssemblyEnv, path: string) {
  if (request.method === 'OPTIONS') return json({ ok: true });
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'one' || parts[2] !== 'workflow' || !parts[3] || parts[4] !== 'master') return json({ error: 'not found' }, 404);
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const body = await request.json().catch(() => ({})) as { projectId?: string; approve?: boolean };
  if (!body.projectId) return json({ error: 'projectId is required' }, 400);
  const project = await getProject(env, body.projectId); if (!project) return json({ error: 'project not found' }, 404);
  const data = packageData(project); const plan = data.oneWorkflow;
  if (!plan || plan.workflowId !== parts[3]) return json({ error: 'workflow not found' }, 404);
  const master = buildMaster(plan);
  if (body.approve === true) {
    if (!master.qa.passed) return json({ status: 'blocked', reason: 'Master QA has not passed.', master }, 409);
    const delivery = plan.artifacts.find(a => a.kind === 'delivery-package');
    const approvedPlan = delivery ? { ...plan, artifacts: plan.artifacts.map(a => a.id === delivery.id ? { ...a, status: 'completed' as const, evidence: 'Master package assembled and approved; public publishing remains separately gated.' } : a) } : plan;
    const approved = { ...master, status: 'approved' as const };
    await persist(project, env, approved, approvedPlan);
    return json({ status: 'approved', master: approved, plan: approvedPlan });
  }
  await persist(project, env, master);
  return json({ status: master.status, master });
}
