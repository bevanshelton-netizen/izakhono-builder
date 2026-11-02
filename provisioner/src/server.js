import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { health } from './health.js';

const port = Number(process.env.PORT || 8080);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const json = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
    if (data.length > 1024 * 1024) reject(new Error('payload_too_large'));
  });
  req.on('end', () => {
    if (!data) return resolve({});
    try { resolve(JSON.parse(data)); } catch { reject(new Error('invalid_json')); }
  });
  req.on('error', reject);
});

const authenticate = async (req) => {
  if (!admin) return { ok: false, status: 503, error: 'provisioner_not_configured' };
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return { ok: false, status: 401, error: 'missing_bearer_token' };
  const token = header.slice(7).trim();
  if (!token) return { ok: false, status: 401, error: 'missing_bearer_token' };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: 'invalid_token' };
  return { ok: true, user: data.user };
};

const rpc = async (fn, args) => {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw error;
  return data;
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, health());
    if (req.method === 'GET' && req.url === '/') {
      return json(res, 200, {
        service: 'izakhono-provisioner',
        status: 'ready',
        api: '/v1/provisioning',
        version: '1.2.0',
      });
    }

    if (req.method !== 'POST' || !req.url?.startsWith('/v1/provisioning/')) {
      return json(res, 404, { error: 'not_found' });
    }

    const auth = await authenticate(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    const body = await readBody(req);

    // Start is intentionally keyed by the confirmed payment transaction.
    // ic_provision_from_payment is idempotent on payment:<transaction_id>.
    if (req.url === '/v1/provisioning/start') {
      if (!body.transaction_id) return json(res, 400, { error: 'transaction_id_required' });
      const jobId = await rpc('ic_provision_from_payment', {
        p_transaction_id: body.transaction_id,
      });
      return json(res, 202, { ok: true, job_id: jobId });
    }

    // A worker advances the durable DB step, not an invented HTTP state machine.
    if (req.url === '/v1/provisioning/advance') {
      if (!body.step_id || !body.status) {
        return json(res, 400, { error: 'step_id_status_required' });
      }
      if (body.status === 'completed') {
        const jobId = await rpc('ic_provisioner_complete_step', {
          p_step_id: body.step_id,
          p_result: body.output ?? {},
        });
        return json(res, 200, { ok: true, job_id: jobId, status: 'completed' });
      }
      if (body.status === 'failed') {
        const jobId = await rpc('ic_provisioner_fail_step', {
          p_step_id: body.step_id,
          p_error: body.error ?? 'provider_step_failed',
          p_retry_minutes: Number.isInteger(body.retry_minutes) ? body.retry_minutes : 5,
        });
        return json(res, 200, { ok: true, job_id: jobId, status: 'failed_or_retry_scheduled' });
      }
      return json(res, 400, { error: 'status_must_be_completed_or_failed' });
    }

    if (req.url === '/v1/provisioning/handover') {
      if (!body.job_id) return json(res, 400, { error: 'job_id_required' });
      const handover = await rpc('ic_build_provisioning_handover', {
        p_job_id: body.job_id,
      });
      return json(res, 200, { ok: true, handover });
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error('provisioner_error', error);
    const message = error?.message || 'internal_error';
    return json(res, 500, { error: 'provisioner_error', message });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`IZAKHONO Provisioner listening on ${port}`));
