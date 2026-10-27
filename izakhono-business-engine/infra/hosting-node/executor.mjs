import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';

const root = process.env.IZAKHONO_RELEASE_ROOT || '/var/lib/izakhono-node/releases';
const maxArtifactBytes = Number(process.env.IZAKHONO_MAX_ARTIFACT_BYTES || 100 * 1024 * 1024);
const maxExtractedFiles = Number(process.env.IZAKHONO_MAX_EXTRACTED_FILES || 5000);
const healthTimeoutMs = Number(process.env.IZAKHONO_HEALTH_TIMEOUT_MS || 120000);
const healthIntervalMs = Number(process.env.IZAKHONO_HEALTH_INTERVAL_MS || 1000);
const basePort = Number(process.env.IZAKHONO_RELEASE_BASE_PORT || 19000);
const maxConcurrent = Number(process.env.IZAKHONO_MAX_CONCURRENT_RELEASES || 1);
let active = 0;
const inFlight = new Map();
const processes = new Map();

function safeId(value) { return /^[a-zA-Z0-9._-]{1,120}$/.test(String(value || '')); }
function safeVersion(value) { return /^[a-zA-Z0-9._-]{1,80}$/.test(String(value || '')); }
function safeRelative(value) {
  const normalized = path.posix.normalize(String(value || '').replaceAll('\\', '/'));
  return normalized !== '.' && !normalized.startsWith('../') && normalized !== '..' && !normalized.startsWith('/');
}
function assertHttpsUrl(value, allowHttp = false) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) throw new Error('ARTIFACT_URL_MUST_USE_HTTPS');
  return url;
}
async function ensureDirs() { await fs.mkdir(root, { recursive: true, mode: 0o750 }); }
function statePath(id) { return path.join(root, `${id}.json`); }
async function writeState(id, state) {
  await ensureDirs();
  const target = statePath(id);
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o640 });
  await fs.rename(temp, target);
}
async function readState(id) { try { return JSON.parse(await fs.readFile(statePath(id), 'utf8')); } catch { return null; } }

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = client(parsed, { method: 'GET', timeout: 30000, headers: { 'user-agent': 'IZAKHONO-Hosting-Node/1.0' } }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        try { return resolve(download(new URL(response.headers.location, parsed).toString(), destination)); } catch (error) { return reject(error); }
      }
      if (response.statusCode !== 200) { response.resume(); return reject(new Error(`ARTIFACT_DOWNLOAD_HTTP_${response.statusCode}`)); }
      const length = Number(response.headers['content-length'] || 0);
      if (length > maxArtifactBytes) { response.resume(); return reject(new Error('ARTIFACT_TOO_LARGE')); }
      const file = fsSync.createWriteStream(destination, { mode: 0o600 });
      let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > maxArtifactBytes) req.destroy(new Error('ARTIFACT_TOO_LARGE'));
      });
      response.on('error', reject);
      file.on('error', reject);
      file.on('finish', () => file.close(() => resolve(bytes)));
      response.pipe(file);
    });
    req.on('timeout', () => req.destroy(new Error('ARTIFACT_DOWNLOAD_TIMEOUT')));
    req.on('error', reject);
    req.end();
  });
}

function runFixed(command, args, cwd, timeoutMs, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', b => { stdout += b.toString(); if (stdout.length > 20000) stdout = stdout.slice(-20000); });
    child.stderr.on('data', b => { stderr += b.toString(); if (stderr.length > 20000) stderr = stderr.slice(-20000); });
    const timer = setTimeout(() => { child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000).unref(); reject(new Error(`${command}_TIMEOUT`)); }, timeoutMs);
    child.on('error', reject);
    child.on('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error(`${command}_FAILED:${stderr.slice(-2000)}`)); else resolve({ stdout, stderr }); });
  });
}

async function validateTar(archive) {
  const { stdout } = await runFixed('tar', ['-tzf', archive], root, 30000);
  const entries = stdout.split('\n').map(v => v.trim()).filter(Boolean);
  if (entries.length > maxExtractedFiles) throw new Error('ARTIFACT_FILE_COUNT_EXCEEDED');
  for (const entry of entries) if (!safeRelative(entry) || entry.includes('\0')) throw new Error('ARTIFACT_PATH_TRAVERSAL');
  return entries;
}

async function healthCheck(url) {
  const deadline = Date.now() + healthTimeoutMs;
  let last = 'HEALTH_CHECK_FAILED';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(5000, Math.max(1000, deadline - Date.now()))) });
      if (response.ok) return true;
      last = `HEALTH_HTTP_${response.status}`;
    } catch (error) { last = error instanceof Error ? error.message : last; }
    await sleep(healthIntervalMs);
  }
  throw new Error(last);
}

function allocatePort(id) {
  const hash = crypto.createHash('sha256').update(id).digest().readUInt32BE(0);
  return basePort + (hash % 1000);
}

export async function executeRelease(request) {
  if (!safeId(request.provider_request_id) || !safeVersion(request.version)) throw new Error('INVALID_RELEASE_ID_OR_VERSION');
  if (!request.artifact_url || !request.checksum) throw new Error('ARTIFACT_URL_CHECKSUM_REQUIRED');
  const checksum = String(request.checksum).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error('SHA256_CHECKSUM_REQUIRED');
  const artifactUrl = assertHttpsUrl(request.artifact_url, process.env.IZAKHONO_ALLOW_HTTP_ARTIFACTS === 'true');
  const id = request.provider_request_id;
  const existing = await readState(id);
  if (existing?.execution_status === 'published') return existing;
  if (inFlight.has(id)) return inFlight.get(id);
  if (active >= maxConcurrent) throw new Error('RELEASE_CONCURRENCY_LIMIT');

  active += 1;
  const promise = (async () => {
    const started = new Date().toISOString();
    const releaseDir = path.join(root, id, request.version);
    const stagingDir = path.join(root, `${id}.staging`);
    const archive = path.join(root, `${id}.artifact`);
    const port = allocatePort(id);
    const state = { provider_request_id: id, version: request.version, execution_status: 'running', started_at: started, published_url: null, port };
    await writeState(id, state);
    try {
      await fs.rm(stagingDir, { recursive: true, force: true });
      await fs.rm(archive, { force: true });
      await fs.mkdir(stagingDir, { recursive: true, mode: 0o750 });
      await writeState(id, { ...state, phase: 'downloading' });
      await download(artifactUrl.toString(), archive);
      const actual = crypto.createHash('sha256').update(await fs.readFile(archive)).digest('hex');
      if (actual !== checksum) throw new Error('ARTIFACT_CHECKSUM_MISMATCH');
      await writeState(id, { ...state, phase: 'verified', checksum: actual });
      await validateTar(archive);
      await runFixed('tar', ['-xzf', archive, '-C', stagingDir], root, 60000);
      const manifest = JSON.parse(await fs.readFile(path.join(stagingDir, 'release.json'), 'utf8'));
      if (manifest.contract !== 'izakhono.app.release.v1') throw new Error('RELEASE_CONTRACT_UNSUPPORTED');
      if (!safeRelative(manifest.entrypoint || '')) throw new Error('INVALID_ENTRYPOINT');
      const entrypoint = path.resolve(stagingDir, manifest.entrypoint);
      if (!entrypoint.startsWith(`${path.resolve(stagingDir)}${path.sep}`)) throw new Error('ENTRYPOINT_PATH_TRAVERSAL');
      const healthPath = manifest.health_path || '/health';
      if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(healthPath)) throw new Error('INVALID_HEALTH_PATH');
      await fs.rm(releaseDir, { recursive: true, force: true });
      await fs.mkdir(path.dirname(releaseDir), { recursive: true, mode: 0o750 });
      await fs.rename(stagingDir, releaseDir);
      if (manifest.install_dependencies !== false && await fileExists(path.join(releaseDir, 'package-lock.json'))) {
        await runFixed('npm', ['ci', '--omit=dev', '--ignore-scripts'], releaseDir, 180000, { NODE_ENV: 'production' });
      }
      const healthUrl = `http://127.0.0.1:${port}${healthPath}`;
      const child = spawn(process.execPath, [path.join(releaseDir, manifest.entrypoint)], { cwd: releaseDir, shell: false, detached: false, stdio: ['ignore', 'ignore', 'ignore'], env: { ...process.env, PORT: String(port), NODE_ENV: 'production' } });
      processes.set(id, child);
      child.on('exit', () => processes.delete(id));
      child.unref();
      await writeState(id, { ...state, phase: 'health_check', release_dir: releaseDir, health_url: healthUrl });
      await healthCheck(healthUrl);
      const base = String(process.env.IZAKHONO_PUBLIC_BASE_URL || '').replace(/\/$/, '');
      if (!base) throw new Error('PUBLIC_BASE_URL_REQUIRED');
      const publishedUrl = `${base}/releases/${encodeURIComponent(id)}/`;
      const finalState = { ...state, execution_status: 'published', phase: 'verified', release_dir: releaseDir, health_url: healthUrl, published_url: publishedUrl, completed_at: new Date().toISOString() };
      await writeState(id, finalState);
      return finalState;
    } catch (error) {
      const failed = { ...state, execution_status: 'failed', phase: 'failed', error: error instanceof Error ? error.message : 'RELEASE_FAILED', completed_at: new Date().toISOString() };
      await writeState(id, failed);
      throw error;
    } finally {
      await fs.rm(archive, { force: true }).catch(() => {});
      await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
      active -= 1;
    }
  })();
  inFlight.set(id, promise);
  try { return await promise; } finally { inFlight.delete(id); }
}

export async function getReleaseStatus(id) {
  if (!safeId(id)) throw new Error('INVALID_PROVIDER_REQUEST_ID');
  return (await readState(id)) || { provider_request_id: id, execution_status: 'unknown' };
}

export async function getReleaseProxyTarget(id) {
  const state = await getReleaseStatus(id);
  if (state.execution_status !== 'published' || !Number.isInteger(state.port)) return null;
  return { host: '127.0.0.1', port: state.port };
}

async function fileExists(file) { try { await fs.access(file); return true; } catch { return false; } }

await ensureDirs();
