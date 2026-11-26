import {
  FACEBOOK_REELS_1080X1920,
  buildFfmpegExportArgs,
  validateMediaProbe,
  validateMp4FastStart,
  type MediaExportProfile,
  type ProbeDocument,
} from './media-export-profile';

export type MediaExportRuntime = {
  run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  sha256(bytes: Uint8Array): Promise<string>;
};

export type MediaExportRequest = {
  sourcePath: string;
  outputPath: string;
  profile?: MediaExportProfile;
  recordedBy: string;
};

export type MediaExportResult = {
  status: 'qa_passed' | 'qa_failed';
  outputPath: string;
  contentHash: string;
  byteLength: number;
  mediaQa: {
    schema: 'izakhono.creator/media-qa-evidence-v1';
    profileId: string;
    passed: boolean;
    assetContentHash: string;
    recordedAt: string;
    recordedBy: string;
    checks: Array<{ id: string; passed: boolean; actual: string; expected: string }>;
  };
};

/**
 * Executes an export using an injected process/filesystem runtime. This keeps
 * FFmpeg out of the Cloudflare request worker while allowing a Node/container
 * media worker to supply real process and object-storage adapters.
 */
export async function executeMediaExport(
  request: MediaExportRequest,
  runtime: MediaExportRuntime,
  now: () => string = () => new Date().toISOString(),
): Promise<MediaExportResult> {
  const profile = request.profile ?? FACEBOOK_REELS_1080X1920;
  if (!request.recordedBy.trim()) throw new Error('A media QA worker identity is required.');
  if (!request.sourcePath.trim() || !request.outputPath.trim()) throw new Error('Source and output paths are required.');
  if (request.sourcePath === request.outputPath) throw new Error('Export must never overwrite the source master.');

  const args = buildFfmpegExportArgs(request.sourcePath, request.outputPath, profile);
  await runtime.run('ffmpeg', args);

  const probeResult = await runtime.run('ffprobe', [
    '-v', 'error', '-show_streams', '-show_format', '-of', 'json', request.outputPath,
  ]);
  let probe: ProbeDocument;
  try {
    probe = JSON.parse(probeResult.stdout) as ProbeDocument;
  } catch {
    throw new Error('ffprobe returned invalid JSON; export cannot be verified.');
  }

  const bytes = await runtime.readFile(request.outputPath);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) throw new Error('FFmpeg produced an empty or unreadable output file.');
  const hash = await runtime.sha256(bytes);
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Runtime must return a 64-character SHA-256 hex digest.');

  const probeQa = validateMediaProbe(probe, profile);
  const fastStart = validateMp4FastStart(bytes);
  const checks = [...probeQa.checks, fastStart];
  const passed = checks.every(check => check.passed);
  return {
    status: passed ? 'qa_passed' : 'qa_failed',
    outputPath: request.outputPath,
    contentHash: hash.toLowerCase(),
    byteLength: bytes.byteLength,
    mediaQa: {
      schema: 'izakhono.creator/media-qa-evidence-v1',
      profileId: profile.id,
      passed,
      assetContentHash: hash.toLowerCase(),
      recordedAt: now(),
      recordedBy: request.recordedBy,
      checks,
    },
  };
}

/** Persist only verified output bytes; callers must not publish from this helper. */
export async function exportAndStore(
  request: MediaExportRequest,
  runtime: MediaExportRuntime,
  store: { put(key: string, bytes: Uint8Array, metadata: { contentType: string; sha256: string }): Promise<void> },
  objectKey: string,
  now?: () => string,
): Promise<MediaExportResult> {
  if (!objectKey.trim()) throw new Error('A destination object key is required.');
  const result = await executeMediaExport(request, runtime, now);
  if (result.status !== 'qa_passed') return result;
  const bytes = await runtime.readFile(result.outputPath);
  const currentHash = await runtime.sha256(bytes);
  if (currentHash.toLowerCase() !== result.contentHash) throw new Error('Export bytes changed after QA; refusing to store unverified content.');
  await store.put(objectKey, bytes, { contentType: 'video/mp4', sha256: result.contentHash });
  return result;
}
