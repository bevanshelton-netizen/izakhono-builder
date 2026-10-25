import { getProject, type CreatorStorageEnv } from './project-store';
import type { OneMasterPackage } from './one-master-assembly';
import type { OneWorkflowPlan } from './one-workflow';

type DistributionEnv = CreatorStorageEnv;
type StoredPackage = Record<string, unknown> & { oneWorkflow?: OneWorkflowPlan; oneMaster?: OneMasterPackage; oneDistribution?: OneDistributionPackage };

export type DistributionStatus = 'blocked' | 'ready' | 'approved';
export type OneDistributionPackage = {
  schema: 'izakhono.one/distribution-v1';
  workflowId: string;
  status: DistributionStatus;
  channels: string[];
  masterStatus: OneMasterPackage['status'];
  deliveryPackageCompleted: boolean;
  publicLive: false;
  publishAdapters: Record<string, 'not-configured'>;
  approvalRequired: 'distribution';
};

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } }); }
function data(project: Awaited<ReturnType<typeof getProject>>): StoredPackage { return project?.packageData && typeof project.packageData === 'object' ? project.packageData as StoredPackage : {}; }

export function buildDistribution(plan: OneWorkflowPlan, master?: OneMasterPackage): OneDistributionPackage {
  const channels = plan.brief.channels?.filter(Boolean) ?? [];
  const delivery = plan.artifacts.find(a => a.kind === 'delivery-package');
  const masterApproved = master?.status === 'approved';
  const deliveryCompleted = delivery?.status === 'completed';
  const ready = masterApproved && deliveryCompleted;
  return {
    schema: 'izakhono.one/distribution-v1',
    workflowId: plan.workflowId,
    status: ready ? 'ready' : 'blocked',
    channels,
    masterStatus: master?.status ?? 'blocked',
    deliveryPackageCompleted: Boolean(deliveryCompleted),
    publicLive: false,
    publishAdapters: Object.fromEntries(channels.map(channel => [channel, 'not-configured' as const])),
    approvalRequired: 'distribution',
  };
}

async function persist(project: NonNullable<Awaited<ReturnType<typeof getProject>>>, env: DistributionEnv, pkg: OneDistributionPackage) {
  const { saveProject } = await import('./project-store');
  const current = data(project);
  return saveProject(env, { id: project.id, brief: project.brief, packageData: { ...current, oneDistribution: pkg } });
}

export async function handleOneDistribution(request: Request, env: DistributionEnv, path: string) {
  if (request.method === 'OPTIONS') return json({ ok: true });
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'api' || parts[1] !== 'one' || parts[2] !== 'workflow' || !parts[3] || parts[4] !== 'distribution') return json({ error: 'not found' }, 404);
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
  const body = await request.json().catch(() => ({})) as { projectId?: string; approve?: boolean };
  if (!body.projectId) return json({ error: 'projectId is required' }, 400);
  const project = await getProject(env, body.projectId); if (!project) return json({ error: 'project not found' }, 404);
  const current = data(project); const plan = current.oneWorkflow; if (!plan || plan.workflowId !== parts[3]) return json({ error: 'workflow not found' }, 404);
  const pkg = buildDistribution(plan, current.oneMaster);
  if (body.approve === true) {
    if (pkg.status !== 'ready') return json({ status: 'blocked', reason: 'Master approval and completed delivery package are required before distribution approval.', distribution: pkg }, 409);
    const approved = { ...pkg, status: 'approved' as const };
    await persist(project, env, approved);
    return json({ status: 'approved', distribution: approved, publicLive: false });
  }
  await persist(project, env, pkg);
  return json({ status: pkg.status, distribution: pkg, publicLive: false });
}
