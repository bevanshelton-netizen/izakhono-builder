export type RenderStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type RenderJobPlan = {
  id: string;
  projectId: string;
  derivativeId: string;
  status: 'queued';
  objectKey: string;
  outputFormat: 'mp4' | 'jpg';
  width: number;
  height: number;
  fps: number;
  command: string[];
  sourceAssetIds: string[];
};

type Shot = { assetId: string; url?: string; durationSeconds?: number | null };
type Derivative = { id: string; width: number; height: number; format: 'mp4' | 'jpg'; aspect: string; purpose: string };

function filterForAspect(aspect: string): string {
  if (aspect === '9:16') return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
  if (aspect === '1:1') return 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080';
  if (aspect === '4:5') return 'scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350';
  return 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080';
}

/**
 * Build deterministic FFmpeg argv for an external worker.
 * Sources are downloaded by the worker first; the Cloudflare Worker never runs FFmpeg.
 * A concat demuxer file is used instead of concat:<remote-url>|... because remote
 * URL concatenation is not reliable for independently encoded HTTP video sources.
 */
export function planRenderJobs(projectId: string, timeline: { fps: number; shots: Shot[] }, derivatives: Derivative[]): RenderJobPlan[] {
  const sources = timeline.shots.filter(s => Boolean(s.url));
  return derivatives.map(d => {
    const id = `render_${projectId}_${d.id}`;
    const objectKey = `projects/${projectId}/renders/${d.id}.${d.format}`;
    const localSources = sources.map(s => `/work/sources/${s.assetId}.mp4`);
    const concatFile = `/work/${id}.concat.txt`;
    const outputPath = `/work/output.${d.format}`;
    const command = d.format === 'jpg'
      ? ['ffmpeg', '-y', '-i', localSources[0] ?? '', '-frames:v', '1', '-vf', filterForAspect(d.aspect), outputPath]
      : ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', concatFile, '-r', String(timeline.fps), '-vf', filterForAspect(d.aspect), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', outputPath];
    return { id, projectId, derivativeId: d.id, status: 'queued', objectKey, outputFormat: d.format, width: d.width, height: d.height, fps: timeline.fps, command, sourceAssetIds: sources.map(s => s.assetId) };
  });
}
