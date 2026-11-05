import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.IZAKHONO_LOCAL_MODEL || 'qwen2.5-coder:3b';
const CHAT_ENDPOINT = process.env.IZAKHONO_LOCAL_MODEL_URL || 'http://127.0.0.1:11434/api/chat';
const ENDPOINT = process.env.IZAKHONO_LOCAL_MODEL_HEALTH_URL || CHAT_ENDPOINT.replace(/\\/api\\/chat\\/?$/, '/api/tags');

export async function verifyLocalModelRuntime(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(ENDPOINT, { signal: AbortSignal.timeout(options.requestTimeoutMs || 5000) });
  if (!response.ok) return { status: 'waiting', reason: 'model-runtime-http-' + response.status };
  const payload = await response.json();
  const models = Array.isArray(payload.models) ? payload.models : [];
  const found = models.find((entry) => entry.name === MODEL || entry.model === MODEL || String(entry.name || '').startsWith(MODEL + ':'));
  if (!found) return { status: 'waiting', reason: 'required-model-not-installed', model: MODEL, available: models.map((entry) => entry.name || entry.model).filter(Boolean) };
  return { status: 'verified', endpoint: ENDPOINT, model: MODEL, modelInstalled: true, exposure: 'loopback-or-owner-allowlisted-private-network' };
}

export async function provisionLocalModelRuntime(options = {}) {
  const runCommand = options.runCommand || ((command, args) => execFileSync(command, args, { cwd: ROOT, stdio: 'pipe', timeout: 120000 }));
  try {
    runCommand('docker', ['compose', '-f', path.join(ROOT, 'compose.yml'), 'up', '-d']);
  } catch (error) {
    return { status: 'waiting', reason: 'docker-compose-runtime-unavailable', detail: String(error.message || error).slice(0, 500) };
  }
  const fetchImpl = options.fetchImpl || fetch;
  const wait = options.wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const attempts = options.attempts || 90;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await verifyLocalModelRuntime({ fetchImpl, requestTimeoutMs: 5000 });
      if (result.status === 'verified') return { ...result, status: 'verified', attempts: attempt, provisioned: true };
    } catch {}
    if (attempt < attempts) await wait(options.intervalMs || 10000);
  }
  return { status: 'waiting', reason: 'model-download-or-startup-not-yet-complete', model: MODEL, attempts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const operation = process.argv[2] || 'verify';
  const result = operation === 'provision' ? await provisionLocalModelRuntime() : await verifyLocalModelRuntime().catch((error) => ({ status: 'waiting', reason: 'model-runtime-unreachable', detail: error.message }));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'verified') process.exitCode = 1;
}
