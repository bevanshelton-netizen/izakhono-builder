import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { health } from './health.js';

const port = Number(process.env.PORT || 8080);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured; API routes will return 503.');
}

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
        version: '1.1.0',
      });
    }

    if (req.method !== 'POST' || !req.url?.startsWith('/v1/provisioning/')) {
      return json(res, 404, { error: 'not_found' });
    }

    const auth = await authenticate(req);
    if (!auth.ok) return json(res, auth.status, { error: auth.error });

    const body = await readBody(req);

    if (req.url === '/v1/provisioning/start') {
      if (!body.order_id) return json(res, 400, { error: 'order_id_required' });
      const provisioningId = await rpc('iz_connect_start_paid_provisioning', { p_order_id: body.order_id });
      return json(res, 202, { ok: true, provisioning_id: provisioningId });
    }

    if (req.url === '/v1/provisioning/advance') {
      if (!body.provisioning_id || !body.step_key || !body.status) {
        return json(res, 400, { error: 'provisioning_id_step_key_status_required' });
      }
      const advanced = await rpc('iz_connect_advance_provisioning', {
        p_provisioning_id: body.provisioning_id,
        p_step_key: body.step_key,
        p_status: body.status,
        p_output: body.output ?? {},
        p_error: body.error ?? null,
      });
      return json(res, 200, { ok: true, advanced });
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error('provisioner_error', error);
    const message = error?.message || 'internal_error';
    return json(res, 500, { error: 'provisioner_error', message });
  }
});

server.listen(port, '0.0.0.0', () => console.log(`IZAKHONO Provisioner listening on ${port}`));
