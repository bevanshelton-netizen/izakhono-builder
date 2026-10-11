import { createAdapters, chooseProvider, generationManifest, type GenerationRequest, type ProviderEnv, type ProviderId } from './provider-router';
import { creatorSkills, selectSkills } from './skill-registry';
import { activateSkill } from './skill-instructions';
import { compileProduction } from './production-compiler';
import { studioHtml } from './studio';

type Env = ProviderEnv & { CREATOR_GENERATION_SECRET?: string };
const skills = creatorSkills;

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } }); }
function authorized(request: Request, env: Env) { return !env.CREATOR_GENERATION_SECRET || request.headers.get('x-creator-generation-secret') === env.CREATOR_GENERATION_SECRET; }

function buildPlan(brief: string) {
  const b = brief.toLowerCase();
  const music = /song|single|track|music/.test(b);
  const social = /tiktok|reel|short|social|promo/.test(b);
  const africa = /africa|african|johannesburg|south africa|amapiano|afrobeats|zulu|xhosa|sesotho|setswana|swahili/.test(b);
  const title = music ? 'Music-led visual production' : 'Creative production';
  const stages = [
    { name: 'Creative treatment', description: 'Lock story, audience, tone, visual language, duration and success criteria.', output: 'director treatment' },
    ...(music ? [{ name: 'Music-video structure', description: 'Map intro, verses, hooks, bridge and outro to narrative beats and visual motifs.', output: 'scene + shot plan' }] : []),
    { name: 'Visual continuity', description: 'Define recurring characters, wardrobe, locations, props, lighting and camera language.', output: 'continuity bible' },
    { name: 'Generation / production', description: 'Send approved shots to configured image, video, voice and audio adapters.', output: 'provider jobs' },
    { name: 'Edit & master', description: 'Assemble approved assets, sync timing, mix audio and prepare delivery masters.', output: 'master package' },
    ...(social ? [{ name: 'Social derivatives', description: 'Create platform-specific vertical cuts, hooks, captions and thumbnails from the master.', output: 'social pack' }] : []),
    ...(africa ? [{ name: 'Localization review', description: 'Adapt language and cultural references for selected African markets with human review.', output: 'localized variants' }] : []),
  ];
  return { title, logline: brief, stages, gates: ['creative approval', 'generation approval', 'final QA', 'publishing approval'] };
}

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  if (env.CREATOR_GENERATION_ENABLED !== 'true') return json({ error: 'Generation is disabled. Configure CREATOR_GENERATION_ENABLED=true after provider and billing review.' }, 403);
  if (!authorized(request, env)) return json({ error: 'generation authorization required' }, 401);
  const body = await request.json().catch(() => null) as { approved?: boolean; requests?: GenerationRequest[]; provider?: string } | null;
  if (!body?.approved) return json({ error: 'explicit generation approval is required' }, 400);
  if (!Array.isArray(body.requests) || body.requests.length === 0) return json({ error: 'requests are required' }, 400);
  if (body.requests.length > 50) return json({ error: 'maximum 50 generation requests per batch' }, 400);
  const adapters = createAdapters(env);
  const jobs = [];
  for (const generationRequest of body.requests) {
    const adapter = chooseProvider(generationRequest, adapters, body.provider ?? env.CREATOR_PROVIDER);
    if (!adapter) { jobs.push({ id: `creator_${crypto.randomUUID()}`, provider: 'runway', kind: generationRequest.kind, status: 'failed', error: 'No enabled provider supports this request' }); continue; }
    jobs.push(await adapter.submit(generationRequest));
  }
  return json({ status: 'submitted', manifest: generationManifest(body.requests, jobs) });
}

async function handlePoll(request: Request, env: Env, provider: string, externalId: string): Promise<Response> {
  if (env.CREATOR_GENERATION_ENABLED !== 'true') return json({ error: 'Generation is disabled.' }, 403);
  if (!authorized(request, env)) return json({ error: 'generation authorization required' }, 401);
  if (!['runway', 'kling', 'luma'].includes(provider)) return json({ error: 'unsupported provider' }, 400);
  if (!externalId || externalId.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(externalId)) return json({ error: 'invalid external job id' }, 400);
  const adapter = createAdapters(env).find(item => item.id === provider as ProviderId);
  if (!adapter?.enabled) return json({ error: `${provider} is not configured` }, 503);
  return json({ status: 'polled', job: await adapter.poll(externalId, 'video') });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return new Response(studioHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, product: 'izakhono-creator', version: '0.6.0' });
    if (request.method === 'GET' && url.pathname === '/api/skills') return json({ skills });
    if (request.method === 'GET' && url.pathname.startsWith('/api/skills/')) { const id = url.pathname.slice('/api/skills/'.length).replace(/\/activate$/, ''); const activated = activateSkill(id); if (!activated) return json({ error: 'skill not found' }, 404); return json({ status: 'activated', ...activated }); }
    if (request.method === 'GET' && url.pathname === '/api/providers') return json({ providers: createAdapters(env).map(a => ({ id: a.id, enabled: a.enabled })) });
    if (request.method === 'GET' && url.pathname.startsWith('/api/jobs/')) { const parts = url.pathname.split('/').filter(Boolean); if (parts.length !== 3) return json({ error: 'expected /api/jobs/:provider/:externalId' }, 400); return handlePoll(request, env, parts[1], parts[2]); }
    if (request.method === 'POST' && url.pathname === '/api/plan') { const body = await request.json().catch(() => null) as { brief?: string } | null; if (!body?.brief?.trim()) return json({ error: 'brief is required' }, 400); const routed = selectSkills(body.brief); return json({ status: 'planned', skills: routed, plan: buildPlan(body.brief), provider_generation: false }); }
    if (request.method === 'POST' && url.pathname === '/api/production-package') { const body = await request.json().catch(() => null) as { brief?: string; aspectRatio?: string; durationSeconds?: number } | null; if (!body?.brief?.trim()) return json({ error: 'brief is required' }, 400); const requests = compileProduction(body); return json({ status: 'compiled', approval_required: true, requests, count: requests.length }); }
    if (request.method === 'POST' && url.pathname === '/api/generate') return handleGenerate(request, env);
    return new Response('Not found', { status: 404 });
  }
};
