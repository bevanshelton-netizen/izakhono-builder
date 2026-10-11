import { createAdapters, chooseProvider, generationManifest, type GenerationRequest, type ProviderEnv } from './provider-router';

type Skill = {
  id: string;
  name: string;
  description: string;
  triggers: string[];
};

type Env = ProviderEnv & { CREATOR_GENERATION_SECRET?: string };

const skills: Skill[] = [
  { id: 'director', name: 'Director', description: 'Turns a creative brief into a treatment, scenes, pacing and production constraints.', triggers: ['video', 'film', 'story', 'director', 'cinematic'] },
  { id: 'music-video', name: 'Music Video', description: 'Maps a song into a music-video treatment, scene list and shot plan.', triggers: ['song', 'single', 'music video', 'music-video', 'track'] },
  { id: 'social-pack', name: 'Social Pack', description: 'Plans TikTok, Reels and Shorts derivatives from the master creative.', triggers: ['tiktok', 'reel', 'reels', 'shorts', 'social', 'promo'] },
  { id: 'african-localization', name: 'African Localization', description: 'Plans language and market adaptations with cultural review and anti-stereotyping safeguards.', triggers: ['africa', 'african', 'zulu', 'xhosa', 'sesotho', 'setswana', 'swahili', 'amapiano', 'afrobeats'] },
];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IZAKHONO CREATOR</title><style>body{margin:0;font-family:Inter,system-ui,sans-serif;background:#07110f;color:#f4f7f5}main{max-width:980px;margin:auto;padding:40px 20px}h1{font-size:44px;margin:0 0 8px}p{color:#aab8b2}.hero{padding:28px 0}.card{background:#0d1d19;border:1px solid #24443a;border-radius:20px;padding:22px;margin-top:20px}textarea{width:100%;min-height:130px;box-sizing:border-box;background:#07110f;color:white;border:1px solid #31574b;border-radius:14px;padding:16px;font:inherit}button{margin-top:12px;border:0;border-radius:999px;padding:13px 20px;font-weight:700;cursor:pointer}.chips span{display:inline-block;border:1px solid #31574b;border-radius:999px;padding:7px 11px;margin:5px 5px 0 0;font-size:13px}.scene{padding:12px 0;border-bottom:1px solid #203a32}.muted{font-size:13px;color:#80958d}</style></head><body><main><section class="hero"><div class="muted">IZAKHONO • CREATIVE PRODUCTION ENGINE</div><h1>Direct your next production.</h1><p>Describe what you want. CREATOR turns the brief into a reviewable production plan and routes the right skills.</p></section><section class="card"><textarea id="brief" placeholder="Example: I have a new Amapiano single. Make a cinematic Johannesburg story about a young woman rising from the streets to become a football legend. Give me the full music video and social cuts."></textarea><button onclick="plan()">Build production plan</button></section><section id="result"></section></main><script>async function plan(){const brief=document.getElementById('brief').value.trim();if(!brief)return;const r=await fetch('/api/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brief})});const x=await r.json();document.getElementById('result').innerHTML='<section class="card"><div class="muted">ROUTED SKILLS</div><div class="chips">'+x.skills.map(s=>'<span>'+s.name+'</span>').join('')+'</div><h2>'+x.plan.title+'</h2><p>'+x.plan.logline+'</p><h3>Production stages</h3>'+x.plan.stages.map((s,i)=>'<div class="scene"><b>'+(i+1)+'. '+s.name+'</b><br>'+s.description+'<div class="muted">Output: '+s.output+'</div></div>').join('')+'<h3>Approval gates</h3><div class="chips">'+x.plan.gates.map(g=>'<span>'+g+'</span>').join('')+'</div><p class="muted">Status: '+x.status+' • Provider generation is not claimed until an adapter supplies evidence.</p></section>'}</script></body></html>`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } });
}

function routeSkills(brief: string) {
  const b = brief.toLowerCase();
  const selected = skills.filter(s => s.triggers.some(t => b.includes(t)));
  return selected.length ? selected : [skills[0], skills[1]];
}

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
  if (env.CREATOR_GENERATION_SECRET && request.headers.get('x-creator-generation-secret') !== env.CREATOR_GENERATION_SECRET) return json({ error: 'generation authorization required' }, 401);
  const body = await request.json().catch(() => null) as { approved?: boolean; requests?: GenerationRequest[]; provider?: string } | null;
  if (!body?.approved) return json({ error: 'explicit generation approval is required' }, 400);
  if (!Array.isArray(body.requests) || body.requests.length === 0) return json({ error: 'requests are required' }, 400);
  if (body.requests.length > 50) return json({ error: 'maximum 50 generation requests per batch' }, 400);

  const adapters = createAdapters(env);
  const jobs = [];
  for (const generationRequest of body.requests) {
    const adapter = chooseProvider(generationRequest, adapters, body.provider ?? env.CREATOR_PROVIDER);
    if (!adapter) {
      jobs.push({ id: `creator_${crypto.randomUUID()}`, provider: 'runway', kind: generationRequest.kind, status: 'failed', error: 'No enabled provider supports this request' });
      continue;
    }
    jobs.push(await adapter.submit(generationRequest));
  }
  return json({ status: 'submitted', manifest: generationManifest(body.requests, jobs) });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, product: 'izakhono-creator', version: '0.2.0' });
    if (request.method === 'GET' && url.pathname === '/api/skills') return json({ skills });
    if (request.method === 'GET' && url.pathname === '/api/providers') return json({ providers: createAdapters(env).map(a => ({ id: a.id, enabled: a.enabled })) });
    if (request.method === 'POST' && url.pathname === '/api/plan') {
      const body = await request.json().catch(() => null) as { brief?: string } | null;
      if (!body?.brief?.trim()) return json({ error: 'brief is required' }, 400);
      const routed = routeSkills(body.brief);
      return json({ status: 'planned', skills: routed, plan: buildPlan(body.brief), provider_generation: false });
    }
    if (request.method === 'POST' && url.pathname === '/api/generate') return handleGenerate(request, env);
    return new Response('Not found', { status: 404 });
  }
};
