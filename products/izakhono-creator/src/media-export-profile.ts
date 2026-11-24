/**
 * Reusable, provider-neutral media export contracts for IZAKHONO Creator.
 * This module validates an ffprobe JSON result; it does not claim to render media.
 */

export type MediaExportProfile = {
  id: string;
  container: 'mp4';
  video: { codec: 'h264'; width: number; height: number; pixelFormat: 'yuv420p'; frameRate: { numerator: number; denominator: number } };
  audio: { codec: 'aac'; sampleRate: number; channels: 2 };
  fastStart: true;
};

export const FACEBOOK_REELS_1080X1920: MediaExportProfile = {
  id: 'facebook-reels-1080x1920-v1',
  container: 'mp4',
  video: { codec: 'h264', width: 1080, height: 1920, pixelFormat: 'yuv420p', frameRate: { numerator: 30, denominator: 1 } },
  audio: { codec: 'aac', sampleRate: 48000, channels: 2 },
  fastStart: true,
};

export type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
};

export type ProbeDocument = {
  streams?: ProbeStream[];
  format?: { format_name?: string; duration?: string | number; start_time?: string | number };
};

export type MediaQaCheck = { id: string; passed: boolean; actual: string; expected: string };
export type MediaQaReport = {
  schema: 'izakhono.creator/media-qa-v1';
  profileId: string;
  passed: boolean;
  checks: MediaQaCheck[];
  manualChecksRequired: string[];
};

function rational(value?: string): number | null {
  if (!value) return null;
  const parts = value.split('/');
  if (parts.length !== 2) return null;
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function closeEnough(actual: number | null, expected: number): boolean {
  return actual !== null && Math.abs(actual - expected) < 0.001;
}

/** Validate actual ffprobe JSON against a named delivery profile. */
export function validateMediaProbe(probe: ProbeDocument, profile: MediaExportProfile = FACEBOOK_REELS_1080X1920): MediaQaReport {
  const streams = probe.streams ?? [];
  const video = streams.find(stream => stream.codec_type === 'video');
  const audio = streams.find(stream => stream.codec_type === 'audio');
  const formatNames = (probe.format?.format_name ?? '').split(',');
  const duration = Number(probe.format?.duration);
  const expectedFps = profile.video.frameRate.numerator / profile.video.frameRate.denominator;
  const actualFps = rational(video?.avg_frame_rate) ?? rational(video?.r_frame_rate);
  const checks: MediaQaCheck[] = [
    { id: 'container-mp4', passed: formatNames.includes('mp4'), actual: formatNames.join(',') || 'missing', expected: 'mp4 container' },
    { id: 'duration-positive', passed: Number.isFinite(duration) && duration > 0, actual: String(probe.format?.duration ?? 'missing'), expected: 'finite duration greater than zero' },
    { id: 'video-stream-present', passed: Boolean(video), actual: video ? 'present' : 'missing', expected: 'one video stream' },
    { id: 'video-h264', passed: video?.codec_name === profile.video.codec, actual: video?.codec_name ?? 'missing', expected: profile.video.codec },
    { id: 'video-dimensions', passed: video?.width === profile.video.width && video?.height === profile.video.height, actual: video ? `${video.width}x${video.height}` : 'missing', expected: `${profile.video.width}x${profile.video.height}` },
    { id: 'video-pixel-format', passed: video?.pix_fmt === profile.video.pixelFormat, actual: video?.pix_fmt ?? 'missing', expected: profile.video.pixelFormat },
    { id: 'video-frame-rate', passed: closeEnough(actualFps, expectedFps), actual: actualFps === null ? 'unreadable' : String(actualFps), expected: String(expectedFps) },
    { id: 'audio-stream-present', passed: Boolean(audio), actual: audio ? 'present' : 'missing', expected: 'one audio stream' },
    { id: 'audio-aac', passed: audio?.codec_name === profile.audio.codec, actual: audio?.codec_name ?? 'missing', expected: profile.audio.codec },
    { id: 'audio-sample-rate', passed: Number(audio?.sample_rate) === profile.audio.sampleRate, actual: audio?.sample_rate ?? 'missing', expected: String(profile.audio.sampleRate) },
    { id: 'audio-stereo', passed: audio?.channels === profile.audio.channels, actual: audio?.channels === undefined ? 'missing' : String(audio.channels), expected: String(profile.audio.channels) },
  ];
  return {
    schema: 'izakhono.creator/media-qa-v1',
    profileId: profile.id,
    passed: checks.every(check => check.passed),
    checks,
    manualChecksRequired: [
      'Confirm the complete film plays from first frame to final frame without black frames, freezes, corrupt frames or unintended gaps.',
      'Review dialogue, music and effects for intelligibility, clipping, sync and rights clearance.',
      'Review captions, spelling, language, timing and Facebook/Reels safe areas on a mobile-sized display.',
      'Review character, wardrobe, location and shot continuity; confirm titles, credits and end card.',
      'Inspect MP4 fast-start metadata placement and verify playback after upload to a private test destination.',
      'Confirm the approved master and distribution gates before any external publication.',
    ],
  };
}

/** Build an argv array (not a shell string) for a deterministic profile transcode. */
export function buildFfmpegExportArgs(inputPath: string, outputPath: string, profile: MediaExportProfile = FACEBOOK_REELS_1080X1920): string[] {
  if (!inputPath.trim() || !outputPath.trim()) throw new Error('Input and output paths are required.');
  return [
    '-hide_banner', '-y', '-i', inputPath,
    '-map', '0:v:0', '-map', '0:a:0',
    '-vf', `scale=${profile.video.width}:${profile.video.height}:force_original_aspect_ratio=decrease,pad=${profile.video.width}:${profile.video.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
    '-c:v', 'libx264', '-pix_fmt', profile.video.pixelFormat,
    '-r', String(profile.video.frameRate.numerator / profile.video.frameRate.denominator),
    '-c:a', 'aac', '-ar', String(profile.audio.sampleRate), '-ac', String(profile.audio.channels),
    '-movflags', '+faststart', '-f', profile.container, outputPath,
  ];
}
