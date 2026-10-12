import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const PORT = Number(process.env.PORT || 8787);
const CALLBACK_URL = process.env.CREATOR_CALLBACK_URL;
const WORKER_SECRET = process.env.CREATOR_RENDER_WORKER_SECRET;
const MAX_SOURCE_BYTES = Number(process.env.MAX_SOURCE_BYTES || 524288000);
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const r2 = R2_ENDPOINT && R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
  ? new S3Client({ endpoint: R2_ENDPOINT, region: 'auto', credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })
  : null;

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
function auth(req) {
  return Boolean(WORKER_SECRET) && req.headers['x-creator-render-worker-secret'] === WORKER_SECRET;
}
function safeId(value) { return String(value || '').replace(/[^A-Za-z0-9._-]/g, '_'); }

async function download(url, target) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`source download failed: HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_SOURCE_BYTES) throw new Error('source exceeds configured size limit');
  const file = await response.arrayBuffer();
  if (file.byteLength > MAX_SOURCE_BYTES) throw new Error('source exceeds configured size limit');
  await writeFile(target, Buffer.from(file));
}

function ffmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-y', ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg exited ${code}: ${stderr}`)));
  });
}
function vf(aspect) {
  if (aspect === '9:16') return 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';
  if (aspect === '1:1') return 'scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080';
  if (aspect === '4:5') return 'scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350';
  return 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080';
}
async function uploadToR2(filePath, objectKey, format) {
  if (!r2 || !R2_BUCKET) throw new Error('R2 upload is not configured');
  const info = await stat(filePath);
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: objectKey, Body: createReadStream(filePath), ContentLength: info.size,
    ContentType: format === 'jpg' ? 'image/jpeg' : 'video/mp4'
  }));
  return { bytes: info.size, objectKey };
}
async function render(job) {
  if (job?.schema !== 'izakhono.creator/render-job-v1') throw new Error('invalid render job schema');
  if (!Array.isArray(job.sources) || job.sources.length === 0) throw new Error('render job has no sources');
  const root = await mkdtemp(join(tmpdir(), 'izakhono-render-'));
  const sources = join(root, 'sources'); const output = join(root, 'output');
  await mkdir(sources); await mkdir(output);
  try {
    const files = [];
    for (let i = 0; i < job.sources.length; i++) {
      const file = join(sources, `${String(i).padStart(4, '0')}.mp4`);
      await download(job.sources[i].url, file); files.push(file);
    }
    const concat = join(root, 'concat.txt');
    await writeFile(concat, files.map(file => `file '${file.replaceAll("'", "'\\''")}'`).join('\n') + '\n');
    const out = join(output, `${safeId(job.derivativeId)}.${job.output.format}`);
    if (job.output.format === 'jpg') {
      await ffmpeg(['-i', files[0], '-frames:v', '1', '-vf', vf(job.aspect), '-q:v', '2', out], root);
    } else {
      await ffmpeg(['-f', 'concat', '-safe', '0', '-i', concat, '-r', String(job.fps || 30), '-vf', vf(job.aspect), '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', out], root);
    }
    return uploadToR2(out, job.output.objectKey, job.output.format);
  } finally { await rm(root, { recursive: true, force: true }); }
}
async function callback(result) {
  if (!CALLBACK_URL) throw new Error('CREATOR_CALLBACK_URL is not configured');
  const url = CALLBACK_URL.replace('{renderId}', encodeURIComponent(String(result.renderId)));
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-creator-render-worker-secret': WORKER_SECRET || '' }, body: JSON.stringify(result) });
  if (!response.ok) throw new Error(`callback failed: HTTP ${response.status}`);
}

const server = (await import('node:http')).createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, service: 'izakhono-creator-render-worker', ffmpeg: true, r2: Boolean(r2) });
  if (req.method !== 'POST' || req.url !== '/render') return send(res, 404, { error: 'not found' });
  if (!auth(req)) return send(res, 401, { error: 'render worker authorization required' });
  let body = ''; for await (const chunk of req) body += chunk;
  if (body.length > 200000) return send(res, 413, { error: 'job too large' });
  let job; try { job = JSON.parse(body); } catch { return send(res, 400, { error: 'invalid JSON' }); }
  const executionId = randomUUID(); send(res, 202, { status: 'accepted', executionId, renderId: job.renderId });
  try {
    const result = await render(job);
    await callback({ schema: 'izakhono.creator/render-result-v1', renderId: job.renderId, status: 'completed', objectKey: result.objectKey, metadata: { executionId, bytes: result.bytes } });
  } catch (error) {
    await callback({ schema: 'izakhono.creator/render-result-v1', renderId: job.renderId, status: 'failed', error: error instanceof Error ? error.message : String(error), metadata: { executionId } }).catch(() => {});
  }
});
server.listen(PORT, () => console.log(`IZAKHONO Creator Render Worker listening on ${PORT}`));
