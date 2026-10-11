export type MediaKind = 'image' | 'video' | 'audio';
export type ProviderId = 'runway' | 'kling' | 'luma';

export type GenerationRequest = {
  kind: MediaKind;
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: number;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
};

export type GenerationJob = {
  id: string;
  provider: ProviderId;
  kind: MediaKind;
  status: 'queued' | 'submitted' | 'completed' | 'failed';
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
};

const id = () => `creator_${crypto.randomUUID()}`;

export function createAdapters(env: ProviderEnv): ProviderAdapter[] {
  return [
    runwayAdapter(env),
    klingAdapter(env),
    lumaAdapter(env),
  ];
}

function runwayAdapter(env: ProviderEnv): ProviderAdapter {
  return {
    id: 'runway',
    enabled: Boolean(env.RUNWAY_API_KEY),
    supports: (r) => r.kind === 'video',
    async submit(r) {
      if (!env.RUNWAY_API_KEY) return { id: id(), provider: 'runway', kind: r.kind, status: 'failed', error: 'RUNWAY_API_KEY is not configured' };
      const payload: Record<string, unknown> = {
        model: 'gen4.5',
        promptText: r.prompt,
        ratio: r.aspectRatio ?? '1280:720',
        duration: r.durationSeconds ?? 5,
      };
      if (r.firstFrameUrl) payload.promptImage = r.firstFrameUrl;
      const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RUNWAY_API_KEY}`, 'X-Runway-Version': '2024-11-06' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return { id: id(), provider: 'runway', kind: r.kind, status: 'failed', error: `Runway ${response.status}` };
      const data = await response.json() as { id?: string };
      return { id: id(), provider: 'runway', kind: r.kind, status: 'submitted', externalId: data.id };
    },
  };
}

function klingAdapter(env: ProviderEnv): ProviderAdapter {
  return {
    id: 'kling',
    enabled: Boolean(env.KLING_API_KEY),
    supports: (r) => r.kind === 'video',
    async submit(r) {
      if (!env.KLING_API_KEY) return { id: id(), provider: 'kling', kind: r.kind, status: 'failed', error: 'KLING_API_KEY is not configured' };
      const contents: Record<string, string>[] = [{ type: 'prompt', text: r.prompt }];
      if (r.firstFrameUrl) contents.push({ type: 'first_frame', url: r.firstFrameUrl });
      if (r.lastFrameUrl) contents.push({ type: 'last_frame', url: r.lastFrameUrl });
      const response = await fetch('https://api-singapore.klingai.com/text-to-video/kling-3.0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.KLING_API_KEY}` },
        body: JSON.stringify({
          prompt: r.prompt,
          settings: { resolution: '1080p', aspect_ratio: r.aspectRatio ?? '16:9', duration: r.durationSeconds ?? 5, multi_shot: true, audio: 'off' },
          options: { watermark_info: { enabled: false } },
          contents,
        }),
      });
      if (!response.ok) return { id: id(), provider: 'kling', kind: r.kind, status: 'failed', error: `Kling ${response.status}` };
      const data = await response.json() as { data?: { task_id?: string }; task_id?: string };
      return { id: id(), provider: 'kling', kind: r.kind, status: 'submitted', externalId: data.data?.task_id ?? data.task_id };
    },
  };
}

function lumaAdapter(env: ProviderEnv): ProviderAdapter {
  return {
    id: 'luma',
    enabled: Boolean(env.LUMA_API_KEY),
    supports: (r) => r.kind === 'video' || r.kind === 'image',
    async submit(r) {
      if (!env.LUMA_API_KEY) return { id: id(), provider: 'luma', kind: r.kind, status: 'failed', error: 'LUMA_API_KEY is not configured' };
      const response = await fetch('https://api.agents.lumalabs.ai/v1/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LUMA_API_KEY}` },
        body: JSON.stringify({
          model: r.kind === 'image' ? 'uni-1' : 'ray-3.2',
          prompt: r.prompt,
          aspect_ratio: r.aspectRatio ?? (r.kind === 'image' ? '1:1' : '16:9'),
        }),
      });
      if (!response.ok) return { id: id(), provider: 'luma', kind: r.kind, status: 'failed', error: `Luma ${response.status}` };
      const data = await response.json() as { id?: string };
      return { id: id(), provider: 'luma', kind: r.kind, status: 'submitted', externalId: data.id };
    },
  };
}

export function chooseProvider(request: GenerationRequest, adapters: ProviderAdapter[], preferred?: string): ProviderAdapter | null {
  const enabled = adapters.filter((a) => a.enabled && a.supports(request));
  if (preferred) return enabled.find((a) => a.id === preferred) ?? null;
  return enabled[0] ?? null;
}

export function generationManifest(requests: GenerationRequest[], jobs: GenerationJob[]) {
  return {
    schema: 'izakhono.creator/generation-manifest-v1',
    generatedAt: new Date().toISOString(),
    requests,
    jobs,
    publicLive: false,
  };
}
