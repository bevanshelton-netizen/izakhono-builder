export type MediaKind = 'image' | 'video' | 'audio';
export type ProviderId = 'runway' | 'kling' | 'luma';
export type JobStatus = 'queued' | 'submitted' | 'processing' | 'completed' | 'failed';

export type GenerationRequest = {
  kind: MediaKind;
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: number;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  shotIndex?: number;
};

export type GenerationJob = {
  id: string;
  provider: ProviderId;
  kind: MediaKind;
  status: JobStatus;
  externalId?: string;
  outputUrl?: string;
  error?: string;
};

export type ProviderEnv = {
  RUNWAY_API_KEY?: string;
  KLING_API_KEY?: string;
  LUMA_API_KEY?: string;
  CREATOR_PROVIDER?: string;
  CREATOR_GENERATION_ENABLED?: string;
};

export type ProviderAdapter = {
  id: ProviderId;
  enabled: boolean;
  supports(request: GenerationRequest): boolean;
  submit(request: GenerationRequest): Promise<GenerationJob>;
  poll(externalId: string, kind: MediaKind): Promise<GenerationJob>;
};

const id = () => `creator_${crypto.randomUUID()}`;

export function createAdapters(env: ProviderEnv): ProviderAdapter[] { return [runwayAdapter(env), klingAdapter(env), lumaAdapter(env)]; }

function runwayAdapter(env: ProviderEnv): ProviderAdapter {
  return {
    id: 'runway', enabled: Boolean(env.RUNWAY_API_KEY), supports: r => r.kind === 'video',
    async submit(r) {
      if (!env.RUNWAY_API_KEY) return { id: id(), provider: 'runway', kind: r.kind, status: 'failed', error: 'RUNWAY_API_KEY is not configured' };
      const payload: Record<string, unknown> = { model: 'gen4.5', promptText: r.prompt, ratio: r.aspectRatio ?? '1280:720', duration: r.durationSeconds ?? 5 };
      if (r.firstFrameUrl) payload.promptImage = r.firstFrameUrl;
      const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RUNWAY_API_KEY}`, 'X-Runway-Version': '2024-11-06' }, body: JSON.stringify(payload) });
      if (!response.ok) return { id: id(), provider: 'runway', kind: r.kind, status: 'failed', error: `Runway ${response.status}` };
      const data = await response.json() as { id?: string };
      return { id: id(), provider: 'runway', kind: r.kind, status: 'submitted', externalId: data.id };
    },
    async poll(externalId, kind) {
      if (!env.RUNWAY_API_KEY) return { id: id(), provider: 'runway', kind, status: 'failed', error: 'RUNWAY_API_KEY is not configured' };
      const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(externalId)}`, { headers: { Authorization: `Bearer ${env.RUNWAY_API_KEY}`, 'X-Runway-Version': '2024-11-06' } });
      if (!response.ok) return { id: id(), provider: 'runway', kind, status: 'failed', externalId, error: `Runway ${response.status}` };
      const data = await response.json() as { id?: string; status?: string; output?: string[]; failure?: string };
      const state = data.status === 'SUCCEEDED' ? 'completed' : data.status === 'FAILED' || data.status === 'CANCELED' ? 'failed' : data.status === 'PENDING' ? 'queued' : 'processing';
      return { id: id(), provider: 'runway', kind, status: state, externalId, outputUrl: data.output?.[0], error: data.failure };
    },
  };
}

function klingAdapter(env: ProviderEnv): ProviderAdapter {
  return {
    id: 'kling', enabled: Boolean(env.KLING_API_KEY), supports: r => r.kind === 'video',
    async submit(r) {
      if (!env.KLING_API_KEY) return { id: id(), provider: 'kling', kind: r.kind, status: 'failed', error: 'KLING_API_KEY is not configured' };
      const imageMode = Boolean(r.firstFrameUrl || r.lastFrameUrl);
      const endpoint = imageMode ? 'https://api-singapore.klingai.com/v1/videos/image2video' : 'https://api-singapore.klingai.com/v1/videos/text2video';
      const payload: Record<string, unknown> = { model_name: 'kling-v3', prompt: r.prompt, duration: String(r.durationSeconds ?? 5), mode: 'pro', sound: 'off', aspect_ratio: r.aspectRatio ?? '16:9', external_task_id: id() };
      if (r.firstFrameUrl) payload.image = r.firstFrameUrl;
      if (r.lastFrameUrl) payload.image_tail = r.lastFrameUrl;
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.KLING_API_KEY}` }, body: JSON.stringify(payload) });
      if (!response.ok) return { id: id(), provider: 'kling', kind: r.kind, status: 'failed', error: `Kling ${response.status}` };
      const data = await response.json() as { data?: { task_id?: string } };
      return { id: id(), provider: 'kling', kind: r.kind, status: 'submitted', externalId: data.data?.task_id };
    },
    async poll(externalId, kind) {
      if (!env.KLING_API_KEY) return { id: id(), provider: 'kling', kind, status: 'failed', error: 'KLING_API_KEY is not configured' };
      const endpoint = 'https://api-singapore.klingai.com/v1/videos/text2video';
      const response = await fetch(`${endpoint}/${encodeURIComponent(externalId)}`, { headers: { Authorization: `Bearer ${env.KLING_API_KEY}` } });
      if (!response.ok) return { id: id(), provider: 'kling', kind, status: 'failed', externalId, error: `Kling ${response.status}` };
      const data = await response.json() as { data?: { task_status?: string; task_status_msg?: string; task_result?: { videos?: Array<{ url?: string }> } } };
      const state = data.data?.task_status === 'succeed' ? 'completed' : data.data?.task_status === 'failed' ? 'failed' : data.data?.task_status === 'submitted' ? 'submitted' : 'processing';
      return { id: id(), provider: 'kling', kind, status: state, externalId, outputUrl: data.data?.task_result?.videos?.[0]?.url, error: data.data?.task_status_msg };
    },
  };
}

function lumaAdapter(env: ProviderEnv): ProviderAdapter {
  return {
    id: 'luma', enabled: Boolean(env.LUMA_API_KEY), supports: r => r.kind === 'video' || r.kind === 'image',
    async submit(r) {
      if (!env.LUMA_API_KEY) return { id: id(), provider: 'luma', kind: r.kind, status: 'failed', error: 'LUMA_API_KEY is not configured' };
      const type = r.kind === 'image' ? 'image' : 'video';
      const body: Record<string, unknown> = { model: r.kind === 'image' ? 'uni-1' : 'ray-3.2', type, prompt: r.prompt, aspect_ratio: r.aspectRatio ?? (r.kind === 'image' ? '1:1' : '16:9') };
      if (r.kind === 'video') body.video = { resolution: '720p', duration: `${r.durationSeconds ?? 5}s` };
      const response = await fetch('https://agents.lumalabs.ai/v1/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LUMA_API_KEY}` }, body: JSON.stringify(body) });
      if (!response.ok) return { id: id(), provider: 'luma', kind: r.kind, status: 'failed', error: `Luma ${response.status}` };
      const data = await response.json() as { id?: string };
      return { id: id(), provider: 'luma', kind: r.kind, status: 'submitted', externalId: data.id };
    },
    async poll(externalId, kind) {
      if (!env.LUMA_API_KEY) return { id: id(), provider: 'luma', kind, status: 'failed', error: 'LUMA_API_KEY is not configured' };
      const response = await fetch(`https://agents.lumalabs.ai/v1/generations/${encodeURIComponent(externalId)}`, { headers: { Authorization: `Bearer ${env.LUMA_API_KEY}` } });
      if (!response.ok) return { id: id(), provider: 'luma', kind, status: 'failed', externalId, error: `Luma ${response.status}` };
      const data = await response.json() as { id?: string; state?: string; failure_code?: string; assets?: { video?: string; image?: string } };
      const state = data.state === 'completed' ? 'completed' : data.state === 'failed' ? 'failed' : data.state === 'queued' ? 'queued' : 'processing';
      return { id: id(), provider: 'luma', kind, status: state, externalId, outputUrl: data.assets?.video ?? data.assets?.image, error: data.failure_code };
    },
  };
}

export function chooseProvider(request: GenerationRequest, adapters: ProviderAdapter[], preferred?: string): ProviderAdapter | null {
  const enabled = adapters.filter(a => a.enabled && a.supports(request));
  if (preferred) return enabled.find(a => a.id === preferred) ?? null;
  return enabled[0] ?? null;
}

export function generationManifest(requests: GenerationRequest[], jobs: GenerationJob[]) {
  return { schema: 'izakhono.creator/generation-manifest-v2', generatedAt: new Date().toISOString(), requests, jobs, publicLive: false };
}
