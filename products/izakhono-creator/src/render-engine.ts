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

function filterForAspect(aspect: string): string[] {
  if (aspect === '9:16') return ['scale=1080:1920:force_original_aspect_ratio=increase', 'crop=1080:1920'];
  if (aspect === '1:1') return ['scale=1080:1080:force_original_aspect_ratio=increase', 'crop=1080:1080'];
  if (aspect === '4:5') return ['scale=1080:1350:force_original_aspect_ratio=increase', 'crop=1080:1350'];
  return ['scale=1920:1080:force_original_aspect_ratio=increase', 'crop=1920:1080'];
}

export function planRenderJobs(projectId: string, timeline: { fps: number; shots: Shot[] }, derivatives: Derivative[]): RenderJobPlan[] {
  const sources = timeline.shots.filter(s => Boolean(s.url));
  const concatList = sources.map(s => s.url).join('|');
  return derivatives.map(d => {
    const id = `render_${projectId}_${d.id}`;
    const objectKey = `projects/${projectId}/renders/${d.id}.${d.format}`;
    const command = d.format === 'jpg'
      ? ['ffmpeg', '-i', sources[0]?.url ?? '', '-frames:v', '1', '-vf', ...filterForAspect(d.aspect), objectKey]
      : ['ffmpeg', '-i', `concat:${concatList}`, '-r', String(timeline.fps), '-vf', ...filterForAspect(d.aspect), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', objectKey];
    return { id, projectId, derivativeId: d.id, status: 'queued', objectKey, outputFormat: d.format, width: d.width, height: d.height, fps: timeline.fps, command, sourceAssetIds: sources.map(s => s.assetId) };
  });
}
