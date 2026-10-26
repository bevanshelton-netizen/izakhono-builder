import { dbFetch } from './server-db';

export type EngineStep = {
  key: string;
  title: string;
  provider: string;
  action: string;
};

export const DEFAULT_ENGINE_STEPS: EngineStep[] = [
  { key: 'provision', title: 'Provision business presence', provider: 'izakhono-provisioner', action: 'prepare_business_presence' },
  { key: 'seo', title: 'Build SEO foundation', provider: 'izakhono-growth', action: 'prepare_seo' },
  { key: 'paid', title: 'Prepare paid acquisition', provider: 'izakhono-growth', action: 'prepare_paid_campaign' },
  { key: 'social', title: 'Prepare social campaign', provider: 'izakhono-growth', action: 'prepare_social_campaign' },
  { key: 'crm', title: 'Activate lead capture', provider: 'izakhono-crm', action: 'activate_lead_capture' },
  { key: 'reporting', title: 'Activate growth reporting', provider: 'izakhono-analytics', action: 'activate_reporting' },
];

export async function enqueueGrowthExecution(workspaceId: string, campaignId?: string) {
  const jobs = await dbFetch('execution_jobs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      workspace_id: workspaceId,
      campaign_id: campaignId ?? null,
      job_type: 'growth_engine',
      status: 'queued',
      attempts: 0,
      payload: { steps: DEFAULT_ENGINE_STEPS },
    }),
  });

  const job = Array.isArray(jobs) ? jobs[0] : jobs;
  if (!job?.id) throw new Error('Execution job could not be created.');

  const stepRows = DEFAULT_ENGINE_STEPS.map((step, index) => ({
    job_id: job.id,
    step_key: step.key,
    title: step.title,
    provider: step.provider,
    action: step.action,
    position: index + 1,
    status: 'queued',
  }));

  await dbFetch('execution_job_steps', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(stepRows),
  });

  return job;
}

export async function claimNextExecution() {
  const jobs = await dbFetch(
    'execution_jobs?status=eq.queued&order=created_at.asc&limit=1',
    { method: 'GET' },
  );
  const job = Array.isArray(jobs) ? jobs[0] : null;
  if (!job?.id) return null;

  const updated = await dbFetch(`execution_jobs?id=eq.${encodeURIComponent(job.id)}&status=eq.queued`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'running', started_at: new Date().toISOString(), attempts: Number(job.attempts ?? 0) + 1 }),
  });

  return Array.isArray(updated) ? updated[0] ?? null : updated;
}

export async function executeNextStep(jobId: string) {
  const rows = await dbFetch(
    `execution_job_steps?job_id=eq.${encodeURIComponent(jobId)}&status=eq.queued&order=position.asc&limit=1`,
    { method: 'GET' },
  );
  const step = Array.isArray(rows) ? rows[0] : null;
  if (!step?.id) return { done: true };

  await dbFetch(`execution_job_steps?id=eq.${encodeURIComponent(step.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'running', started_at: new Date().toISOString() }),
  });

  // Provider execution is deliberately adapter-based. No external provider is assumed here.
  await dbFetch(`execution_job_steps?id=eq.${encodeURIComponent(step.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), result: { provider: step.provider, action: step.action, mode: 'adapter-ready' } }),
  });

  return { done: false, step };
}

export async function finalizeExecution(jobId: string) {
  const remaining = await dbFetch(
    `execution_job_steps?job_id=eq.${encodeURIComponent(jobId)}&status=in.(queued,running)&limit=1`,
    { method: 'GET' },
  );
  if (Array.isArray(remaining) && remaining.length) return false;

  await dbFetch(`execution_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
  });
  return true;
}
