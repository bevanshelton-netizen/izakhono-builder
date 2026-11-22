import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import postgres from 'postgres';

const PORT = Number(process.env.PORT || 8790);
const HOST = String(process.env.HOST || '127.0.0.1');
const LEASE_SECONDS = Math.max(30, Math.min(900, Number(process.env.WORKER_LEASE_SECONDS || 120)));
const MAX_BODY_BYTES = 65536;
const DATABASE_URL = String(process.env.OWNED_WORKER_DATABASE_URL || '');
if (!DATABASE_URL) throw new Error('OWNED_WORKER_DATABASE_URL_REQUIRED');

const db = postgres(DATABASE_URL, {
  max: Number(process.env.DB_POOL_MAX || 5),
  idle_timeout: 20,
  connect_timeout: 8,
  prepare: false,
  application_name: 'izakhono-owned-worker-gateway'
});

const json = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  });
  res.end(JSON.stringify(body));
};
const sha256 = value => createHash('sha256').update(value).digest('hex');
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
};
const readJson = async req => {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return { ok: false, status: 413, error: 'payload_too_large' };
    chunks.push(chunk);
  }
  try { return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }; }
  catch { return { ok: false, status: 400, error: 'invalid_json' }; }
};
const bearer = req => {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
};
async function authenticate(req, res, capability) {
  const token = bearer(req);
  if (token.length < 32 || token.length > 512) {
    json(res, 401, { ok: false, error: 'worker_authentication_required' });
    return null;
  }
  const tokenHash = sha256(token);
  const rows = await db`select * from public.authenticate_owned_worker(${tokenHash})`;
  const worker = rows[0];
  if (!worker || !Array.isArray(worker.capabilities) || !worker.capabilities.includes(capability)) {
    json(res, 401, { ok: false, error: 'worker_credential_invalid_or_scope_denied' });
    return null;
  }
  const touched = await db`select public.touch_owned_worker_credential(${tokenHash}) as ok`;
  if (!touched[0]?.ok) {
    json(res, 401, { ok: false, error: 'worker_credential_expired_or_revoked' });
    return null;
  }
  return { ...worker, tokenHash };
}
async function tenantTx(tenantId, callback) {
  return db.begin(async tx => {
    await tx`select set_config('app.tenant_id', ${tenantId}, true)`;
    return callback(tx);
  });
}
function recordEvent(tx, tenantId, jobId, workerKey, eventType, detail = {}) {
  return tx`insert into public.owned_worker_events (tenant_id, job_id, worker_key, event_type, detail)
    values (${tenantId}, ${jobId}, ${workerKey}, ${eventType}, ${JSON.stringify(detail)}::jsonb)`;
}
const boundedJson = (value, max = 48000) => {
  const encoded = JSON.stringify(value ?? {});
  if (Buffer.byteLength(encoded) > max) throw Object.assign(new Error('json_payload_too_large'), { status: 413 });
  return encoded;
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true, service: 'izakhono-owned-worker-gateway', version: '1.0.0' });
  if (req.method === 'GET' && url.pathname === '/readyz') {
    try { await db`select 1 as ready`; return json(res, 200, { ok: true, database: 'reachable', schema: 'runtime-check-only' }); }
    catch { return json(res, 503, { ok: false, database: 'unavailable' }); }
  }

  const routes = {
    heartbeat: ['POST', /^\/v1\/worker\/heartbeat$/, 'job:heartbeat'],
    claim: ['POST', /^\/v1\/jobs\/claim$/, 'job:claim'],
    lease: ['POST', /^\/v1\/jobs\/([0-9a-f-]{36})\/heartbeat$/, 'job:heartbeat'],
    complete: ['POST', /^\/v1\/jobs\/([0-9a-f-]{36})\/complete$/, 'job:complete'],
    fail: ['POST', /^\/v1\/jobs\/([0-9a-f-]{36})\/fail$/, 'job:fail']
  };
  let selected = null, match = null;
  for (const [name, route] of Object.entries(routes)) {
    const found = url.pathname.match(route[1]);
    if (req.method === route[0] && found) { selected = name; match = found; break; }
  }
  if (!selected) return json(res, 404, { ok: false, error: 'route_not_found' });

  try {
    const worker = await authenticate(req, res, routes[selected][2]);
    if (!worker) return;
    const parsed = await readJson(req);
    if (!parsed.ok) return json(res, parsed.status, { ok: false, error: parsed.error });
    const body = parsed.value || {};

    if (selected === 'heartbeat') {
      return json(res, 200, { ok: true, worker_key: worker.worker_key, at: new Date().toISOString() });
    }

    if (selected === 'claim') {
      const leaseToken = randomBytes(32).toString('base64url');
      const leaseHash = sha256(leaseToken);
      const job = await tenantTx(worker.tenant_id, async tx => {
        const rows = await tx`
          with candidate as (
            select id from public.owned_worker_jobs
            where tenant_id = ${worker.tenant_id}
              and worker_key = ${worker.worker_key}
              and status = 'queued'
              and not_before <= now()
              and attempts < max_attempts
            order by priority desc, created_at asc
            for update skip locked
            limit 1
          )
          update public.owned_worker_jobs j
          set status = 'running', attempts = j.attempts + 1,
              lease_owner = ${worker.worker_key}, lease_token_hash = ${leaseHash},
              lease_expires_at = now() + (${LEASE_SECONDS} * interval '1 second'),
              updated_at = now()
          from candidate c
          where j.id = c.id and j.tenant_id = ${worker.tenant_id}
          returning j.id, j.job_type, j.payload, j.attempts, j.max_attempts, j.lease_expires_at
        `;
        if (!rows[0]) return null;
        await recordEvent(tx, worker.tenant_id, rows[0].id, worker.worker_key, 'claimed', { attempt: rows[0].attempts });
        return rows[0];
      });
      return json(res, 200, job ? { ok: true, job: { ...job, lease_token: leaseToken } } : { ok: true, job: null });
    }

    const jobId = match[1];
    const leaseToken = String(body.lease_token || '');
    if (leaseToken.length < 32 || leaseToken.length > 128) return json(res, 400, { ok: false, error: 'lease_token_required' });
    const leaseHash = sha256(leaseToken);

    if (selected === 'lease') {
      const updated = await tenantTx(worker.tenant_id, async tx => {
        const rows = await tx`
          update public.owned_worker_jobs
          set lease_expires_at = now() + (${LEASE_SECONDS} * interval '1 second'), updated_at = now()
          where id = ${jobId} and tenant_id = ${worker.tenant_id}
            and worker_key = ${worker.worker_key} and status = 'running'
            and lease_token_hash = ${leaseHash} and lease_expires_at > now()
          returning id
        `;
        if (rows[0]) await recordEvent(tx, worker.tenant_id, jobId, worker.worker_key, 'lease_renewed', { lease_seconds: LEASE_SECONDS });
        return rows.length > 0;
      });
      return updated ? json(res, 200, { ok: true, lease_seconds: LEASE_SECONDS }) : json(res, 409, { ok: false, error: 'lease_invalid_or_expired' });
    }

    if (selected === 'complete') {
      const resultJson = boundedJson(body.result);
      const completed = await tenantTx(worker.tenant_id, async tx => {
        const rows = await tx`
          update public.owned_worker_jobs
          set status = 'completed', result = ${resultJson}::jsonb, completed_at = now(),
              updated_at = now(), lease_owner = null, lease_token_hash = null, lease_expires_at = null,
              error_code = null, error_message = null
          where id = ${jobId} and tenant_id = ${worker.tenant_id}
            and worker_key = ${worker.worker_key} and status = 'running'
            and lease_token_hash = ${leaseHash} and lease_expires_at > now()
          returning id
        `;
        if (rows[0]) await recordEvent(tx, worker.tenant_id, jobId, worker.worker_key, 'completed', { result_recorded: true });
        return rows.length > 0;
      });
      return completed ? json(res, 200, { ok: true, status: 'completed' }) : json(res, 409, { ok: false, error: 'lease_invalid_or_expired' });
    }

    if (selected === 'fail') {
      const errorCode = String(body.error_code || 'worker_execution_failed').slice(0, 80);
      const errorMessage = String(body.error_message || 'Worker execution failed').slice(0, 1000);
      const outcome = await tenantTx(worker.tenant_id, async tx => {
        const rows = await tx`
          update public.owned_worker_jobs
          set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
              not_before = case when attempts >= max_attempts then not_before
                else now() + (least(30, greatest(1, attempts * 5)) * interval '1 minute') end,
              error_code = ${errorCode}, error_message = ${errorMessage},
              updated_at = now(), lease_owner = null, lease_token_hash = null, lease_expires_at = null
          where id = ${jobId} and tenant_id = ${worker.tenant_id}
            and worker_key = ${worker.worker_key} and status = 'running'
            and lease_token_hash = ${leaseHash} and lease_expires_at > now()
          returning status, attempts
        `;
        if (rows[0]) await recordEvent(tx, worker.tenant_id, jobId, worker.worker_key,
          rows[0].status === 'failed' ? 'failed' : 'retry_scheduled',
          { attempt: rows[0].attempts, error_code: errorCode });
        return rows[0] || null;
      });
      return outcome ? json(res, 200, { ok: true, status: outcome.status, attempts: outcome.attempts }) : json(res, 409, { ok: false, error: 'lease_invalid_or_expired' });
    }
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (!res.headersSent) json(res, status, { ok: false, error: status === 500 ? 'worker_gateway_error' : String(error.message || 'request_failed') });
  }
});

server.listen(PORT, HOST, () => {
  console.log('IZAKHONO_OWNED_WORKER_GATEWAY=READY');
  console.log('HOST=' + HOST + ' PORT=' + PORT);
  console.log('LEASE_SECONDS=' + LEASE_SECONDS);
});
async function shutdown() {
  server.close();
  await db.end({ timeout: 5 });
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
