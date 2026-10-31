import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function classify(text) {
  const t = text.toLowerCase();
  if (/crm|customer|lead|sales pipeline/.test(t)) return 'CRM';
  if (/website|site|landing page|web/.test(t)) return 'WEBSITE';
  if (/app|mobile|software|portal|dashboard/.test(t)) return 'APP';
  if (/pdf|document|proposal|report|memo/.test(t)) return 'DOCUMENT';
  if (/presentation|slides|deck/.test(t)) return 'PRESENTATION';
  if (/marketing|advert|campaign|social|content/.test(t)) return 'MARKETING';
  if (/research|analyse|analyze|investigate/.test(t)) return 'RESEARCH';
  return 'BUSINESS_BUILD';
}

function stepsFor(intent) {
  const type = classify(intent);
  const common = [
    ['understand', 'architect', 'UNDERSTAND'],
    ['plan', 'architect', 'PLAN'],
    ['build', 'code', 'BUILD'],
    ['verify', 'qa', 'VERIFY'],
    ['security', 'security', 'SECURITY'],
    ['package', 'deployment', 'PACKAGE'],
  ];
  const extras = {
    WEBSITE: [['design', 'ui', 'DESIGN'], ['publish', 'deployment', 'PUBLISH']],
    APP: [['architecture', 'architect', 'ARCHITECT'], ['test', 'qa', 'TEST']],
    CRM: [['model', 'crm', 'MODEL'], ['connect', 'crm', 'CONNECT']],
    DOCUMENT: [['structure', 'copy', 'STRUCTURE'], ['export', 'deployment', 'EXPORT']],
    PRESENTATION: [['story', 'copy', 'STORY'], ['export', 'deployment', 'EXPORT']],
    MARKETING: [['campaign', 'marketing', 'CAMPAIGN'], ['measure', 'marketing', 'MEASURE']],
    RESEARCH: [['research', 'research', 'RESEARCH'], ['synthesize', 'research', 'SYNTHESIZE']],
    BUSINESS_BUILD: [['architecture', 'architect', 'ARCHITECT'], ['execute', 'code', 'EXECUTE']],
  }[type];
  return [...common.slice(0,2), ...extras, ...common.slice(2)];
}

async function sb(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`supabase_${response.status}`);
  return response.json();
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || body.intent || '').trim();
  if (!prompt) return NextResponse.json({ error: 'prompt_required' }, { status: 400 });

  const intent = classify(prompt);
  const steps = stepsFor(prompt);
  const localPlan = { intent, status: 'QUEUED', steps: steps.map(([stepKey, workerType, label], i) => ({ stepKey, workerType, label, order: i + 1 })) };

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ source: 'owned-local-queue', persisted: false, job: { prompt, intent, ...localPlan } });
    }

    const workspace = (await sb('forge_workspaces?slug=eq.izakhono-forge&limit=1'))?.[0] || (await sb('forge_workspaces', { method: 'POST', body: JSON.stringify({ name: 'IZAKHONO FORGE', slug: 'izakhono-forge' }) }))?.[0];
    const project = (await sb(`forge_projects?workspace_id=eq.${workspace.id}&name=eq.FORGE%20COMMANDS&limit=1`))?.[0] || (await sb('forge_projects', { method: 'POST', body: JSON.stringify({ workspace_id: workspace.id, name: 'FORGE COMMANDS', goal: 'Persist and execute IZAKHONO Forge build requests.' }) }))?.[0];
    const job = (await sb('forge_jobs', { method: 'POST', body: JSON.stringify({ project_id: project.id, prompt, intent, status: 'QUEUED', priority: 50 }) }))?.[0];
    await sb('forge_job_steps', { method: 'POST', body: JSON.stringify(steps.map(([stepKey, workerType], i) => ({ job_id: job.id, step_key: stepKey, worker_type: workerType, status: 'QUEUED', depends_on: i ? [steps[i - 1][0]] : [] }))) });
    await sb('forge_events', { method: 'POST', body: JSON.stringify({ job_id: job.id, project_id: project.id, event_type: 'JOB_QUEUED', actor: 'forge-command', payload: { intent, stepCount: steps.length } }) });
    return NextResponse.json({ source: 'owned-control-plane', persisted: true, job: { id: job.id, prompt, intent, status: 'QUEUED', steps: localPlan.steps } });
  } catch (error) {
    return NextResponse.json({ source: 'owned-local-queue', persisted: false, warning: 'control_plane_unavailable', job: { prompt, intent, ...localPlan }, error: error instanceof Error ? error.message : 'unknown_error' }, { status: 202 });
  }
}
