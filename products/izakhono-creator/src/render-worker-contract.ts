export type RenderWorkerStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type RenderWorkerSource = {
  assetId: string;
  url: string;
  durationSeconds?: number | null;
};

export type RenderWorkerOutput = {
  renderId: string;
  projectId: string;
  derivativeId: string;
  objectKey: string;
  format: 'mp4' | 'jpg';
  width: number;
  height: number;
  fps: number;
};

export type RenderWorkerJob = {
  schema: 'izakhono.creator/render-job-v1';
  renderId: string;
  projectId: string;
  derivativeId: string;
  aspect: '16:9' | '9:16' | '1:1' | '4:5';
  output: RenderWorkerOutput;
  sources: RenderWorkerSource[];
  fps: number;
  ffmpeg: { command: string[]; concatFile: string; outputPath: string };
};

export type RenderWorkerResult = {
  schema: 'izakhono.creator/render-result-v1';
  renderId: string;
  status: Extract<RenderWorkerStatus, 'completed' | 'failed'>;
  outputUrl?: string;
  objectKey?: string;
  durationSeconds?: number;
  error?: string;
};

export function createRenderWorkerJob(input: Omit<RenderWorkerJob, 'schema'>): RenderWorkerJob {
  return { schema: 'izakhono.creator/render-job-v1', ...input };
}

export function createRenderWorkerResult(input: Omit<RenderWorkerResult, 'schema'>): RenderWorkerResult {
  return { schema: 'izakhono.creator/render-result-v1', ...input };
}
