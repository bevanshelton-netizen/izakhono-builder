import { createRenderWorkerJob, type RenderWorkerJob } from './render-worker-contract';
import type { RenderJobPlan } from './render-engine';

type DispatcherEnv = {
  CREATOR_RENDER_WORKER_URL?: string;
  CREATOR_RENDER_WORKER_SECRET?: string;
};

type TimelineSource = {
  assetId: string;
  url?: string;
  durationSeconds?: number | null;
};

type Derivative = {
  id: string;
  aspect: '16:9' | '9:16' | '1:1' | '4:5';
  width: number;
  height: number;
  format: 'mp4' | 'jpg';
};

export async function dispatchRenderJob(
  env: DispatcherEnv,
  plan: RenderJobPlan,
  sources: TimelineSource[],
  derivative: Derivative,
  fps: number,
): Promise<{ dispatched: boolean; responseStatus?: number; job: RenderWorkerJob }> {
  const usableSources = sources.filter(source => Boolean(source.url)).map(source => ({
    assetId: source.assetId,
    url: source.url as string,
    durationSeconds: source.durationSeconds,
  }));
  const job = createRenderWorkerJob({
    renderId: plan.id,
    projectId: plan.projectId,
    derivativeId: plan.derivativeId,
    aspect: derivative.aspect,
    output: {
      renderId: plan.id,
      projectId: plan.projectId,
      derivativeId: plan.derivativeId,
      objectKey: plan.objectKey,
      format: derivative.format,
      width: derivative.width,
      height: derivative.height,
      fps,
    },
    sources: usableSources,
    fps,
    ffmpeg: {
      command: plan.command,
      concatFile: `/tmp/${plan.id}.concat.txt`,
      outputPath: `/tmp/${plan.id}.${derivative.format}`,
    },
  });

  if (!env.CREATOR_RENDER_WORKER_URL) return { dispatched: false, job };
  if (!env.CREATOR_RENDER_WORKER_SECRET) throw new Error('CREATOR_RENDER_WORKER_SECRET is required when CREATOR_RENDER_WORKER_URL is configured');

  const response = await fetch(env.CREATOR_RENDER_WORKER_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-creator-render-worker-secret': env.CREATOR_RENDER_WORKER_SECRET,
    },
    body: JSON.stringify(job),
  });
  if (!response.ok) throw new Error(`render worker rejected job: HTTP ${response.status}`);
  return { dispatched: true, responseStatus: response.status, job };
}
