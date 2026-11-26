import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const WORKLOAD = 'izakhono-nav';
const ACTIONS = new Set(['provision', 'inspect', 'stop', 'replace', 'backup', 'restore']);
const DIGEST = /^sha256:[a-f0-9]{64}$/i;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const SECRET_REF = /^(?:fortress|secret):\/\/[a-zA-Z0-9._/-]{1,240}$/;

function safeError(error) {
  const code = String(error?.code || error?.message || 'PROVIDER_OPERATION_FAILED');
  return code.replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 96);
}

function validateSpec(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('INVALID_WORKLOAD_SPEC'), { statusCode: 400 });
  const releaseId = String(input.release_id || '');
  const digest = String(input.artifact_digest || '').toLowerCase();
  const runtimeId = String(input.logical_runtime_id || 'NODE01');
  const secretRef = String(input.secret_ref || '');
  if (!SAFE_ID.test(releaseId)) throw Object.assign(new Error('INVALID_RELEASE_ID'), { statusCode: 400 });
  if (!DIGEST.test(digest)) throw Object.assign(new Error('IMMUTABLE_ARTIFACT_DIGEST_REQUIRED'), { statusCode: 400 });
  if (!SAFE_ID.test(runtimeId)) throw Object.assign(new Error('INVALID_LOGICAL_RUNTIME_ID'), { statusCode: 400 });
  if (secretRef && !SECRET_REF.test(secretRef)) throw Object.assign(new Error('SECRET_REFERENCE_REQUIRED_NOT_SECRET_VALUE'), { statusCode: 400 });
  return Object.freeze({
    workload: WORKLOAD,
    logical_runtime_id: runtimeId,
    release_id: releaseId,
    artifact_digest: digest,
    secret_ref: secretRef || null,
    storage_profile: 'nav-persistent-v1',
    network_profile: 'private-backplane-edge-only-v1',
    health_contract: ['engine', 'routing', 'search', 'tiles']
  });
}

export function createNavWorkloadController({ dataDir, provider = null, now = () => new Date() }) {
  const stateFile = path.join(dataDir, 'state.json');
  let queue = Promise.resolve();

  async function load() {
    await fs.mkdir(dataDir, { recursive: true });
    try {
      const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
      if (state.version !== 1 || !Array.isArray(state.workloads) || !Array.isArray(state.jobs)) throw new Error('INVALID_NAV_WORKLOAD_STATE');
      return state;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { version: 1, workloads: [], jobs: [], idempotency: {} };
    }
  }

  async function save(state) {
    const temp = stateFile + '.tmp';
    await fs.writeFile(temp, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fs.rename(temp, stateFile);
  }

  async function serialized(fn) {
    const run = queue.then(fn, fn);
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  function job(state, action, workloadId, status = 'running') {
    const record = {
      id: 'navjob_' + crypto.randomUUID().replaceAll('-', ''),
      workload_id: workloadId || null,
      action,
      status,
      created_at: now().toISOString(),
      completed_at: null,
      error_code: null
    };
    state.jobs.push(record);
    if (state.jobs.length > 1000) state.jobs.splice(0, state.jobs.length - 1000);
    return record;
  }

  async function providerCall(method, payload) {
    if (!provider || typeof provider[method] !== 'function') {
      throw Object.assign(new Error('NAV_RUNTIME_PROVIDER_UNAVAILABLE'), { statusCode: 503, code: 'NAV_RUNTIME_PROVIDER_UNAVAILABLE' });
    }
    return provider[method](payload);
  }

  async function handle(req, res, url, readBody, sendJson) {
    const prefix = '/api/workloads/nav';
    if (!url.pathname.startsWith(prefix)) return false;
    if (req.method === 'GET' && url.pathname === prefix) {
      const state = await load();
      sendJson(res, 200, { ok: true, workloads: state.workloads, jobs: state.jobs.slice(-50) });
      return true;
    }

    const parts = url.pathname.slice(prefix.length).split('/').filter(Boolean);
    if (parts.length === 0 && req.method === 'POST') {
      await serialized(async () => {
        let input;
        try { input = await readBody(req); } catch (error) { sendJson(res, error.statusCode || 400, { ok: false, error: safeError(error) }); return; }
        let spec;
        try { spec = validateSpec(input); } catch (error) { sendJson(res, error.statusCode || 400, { ok: false, error: safeError(error) }); return; }
        const key = String(req.headers['idempotency-key'] || input.idempotency_key || '');
        if (!SAFE_ID.test(key)) { sendJson(res, 400, { ok: false, error: 'IDEMPOTENCY_KEY_REQUIRED' }); return; }
        const state = await load();
        if (state.idempotency[key]) {
          const existing = state.workloads.find(item => item.id === state.idempotency[key]);
          sendJson(res, 200, { ok: true, idempotent_replay: true, workload: existing || null });
          return;
        }
        const workloadId = 'navwl_' + crypto.randomUUID().replaceAll('-', '');
        const record = {
          id: workloadId, ...spec, status: 'provisioning', provider_ref: null,
          created_at: now().toISOString(), updated_at: now().toISOString(),
          health: null, last_job_id: null
        };
        const task = job(state, 'provision', workloadId);
        record.last_job_id = task.id;
        state.workloads.push(record);
        state.idempotency[key] = workloadId;
        await save(state);
        try {
          const result = await providerCall('provision', { workload_id: workloadId, spec });
          record.provider_ref = String(result?.provider_ref || '');
          if (!record.provider_ref || record.provider_ref.length > 256) throw Object.assign(new Error('NAV_PROVIDER_REFERENCE_MISSING'), { statusCode: 502, code: 'NAV_PROVIDER_REFERENCE_MISSING' });
          record.status = 'provisioned';
          record.updated_at = now().toISOString();
          task.status = 'verified';
          task.completed_at = now().toISOString();
          await save(state);
          sendJson(res, 202, { ok: true, workload: record, job: task });
        } catch (error) {
          record.status = 'failed';
          record.updated_at = now().toISOString();
          task.status = 'failed';
          task.error_code = safeError(error);
          task.completed_at = now().toISOString();
          await save(state);
          sendJson(res, error.statusCode || 502, { ok: false, error: task.error_code, workload: record, job: task });
        }
      });
      return true;
    }

    if (!parts[0] || !SAFE_ID.test(parts[0])) { sendJson(res, 400, { ok: false, error: 'INVALID_WORKLOAD_ID' }); return true; }
    const workloadId = parts[0];
    const action = parts[1] || 'inspect';
    if (!ACTIONS.has(action) || (parts.length > 1 && !['inspect','stop','replace','backup','restore'].includes(action))) {
      sendJson(res, 404, { ok: false, error: 'UNKNOWN_WORKLOAD_ACTION' }); return true;
    }
    if ((action === 'inspect' && req.method !== 'GET') || (action !== 'inspect' && req.method !== 'POST')) { sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); return true; }

    await serialized(async () => {
      const state = await load();
      const record = state.workloads.find(item => item.id === workloadId);
      if (!record) { sendJson(res, 404, { ok: false, error: 'WORKLOAD_NOT_FOUND' }); return; }
      if (action === 'inspect' && req.method === 'GET') {
        try {
          const result = await providerCall('inspect', { workload_id: workloadId, provider_ref: record.provider_ref });
          const health = result?.health || {};
          record.health = health;
          record.status = result?.ready === true && ['engine','routing','search','tiles'].every(key => health[key] === 'ready') ? 'ready' : 'degraded';
          record.updated_at = now().toISOString();
          await save(state);
          sendJson(res, 200, { ok: true, workload: record });
        } catch (error) { sendJson(res, error.statusCode || 502, { ok: false, error: safeError(error) }); }
        return;
      }
      if (req.method !== 'POST') { sendJson(res, 405, { ok: false, error: 'POST_REQUIRED' }); return; }
      let input = {};
      try { input = await readBody(req); } catch (error) { sendJson(res, error.statusCode || 400, { ok: false, error: safeError(error) }); return; }
      if (action === 'replace') {
        try { input = validateSpec(input); } catch (error) { sendJson(res, error.statusCode || 400, { ok: false, error: safeError(error) }); return; }
      }
      if (action === 'restore' && !/^backup:\/\/[a-zA-Z0-9._/-]{1,240}$/.test(String(input.backup_ref || ''))) { sendJson(res, 400, { ok: false, error: 'VERIFIED_BACKUP_REFERENCE_REQUIRED' }); return; }
      const task = job(state, action, workloadId);
      record.last_job_id = task.id;
      await save(state);
      try {
        const method = action;
        const result = await providerCall(method, { workload_id: workloadId, provider_ref: record.provider_ref, spec: action === 'replace' ? input : undefined, backup_ref: input.backup_ref });
        if (action === 'stop') record.status = 'stopped';
        if (action === 'replace') {
          Object.assign(record, input);
          record.status = 'provisioned';
          record.health = null;
        }
        if (action === 'backup') record.last_backup_ref = String(result?.backup_ref || '');
        if (action === 'restore') record.status = 'restored';
        record.updated_at = now().toISOString();
        task.status = 'verified';
        task.completed_at = now().toISOString();
        await save(state);
        sendJson(res, 200, { ok: true, workload: record, job: task, result: { backup_ref: result?.backup_ref || undefined } });
      } catch (error) {
        task.status = 'failed';
        task.error_code = safeError(error);
        task.completed_at = now().toISOString();
        await save(state);
        sendJson(res, error.statusCode || 502, { ok: false, error: task.error_code, workload: record, job: task });
      }
    });
    return true;
  }

  return { handle };
}
