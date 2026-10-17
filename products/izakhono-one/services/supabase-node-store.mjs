function cleanBase(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function headersFor(schema, key, write = false) {
  const headers = {
    accept: 'application/json',
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    'accept-profile': schema
  };
  if (write) headers['content-profile'] = schema;
  return headers;
}

function parseResponseBody(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function rowFromNode(node) {
  return {
    node_id: node.node_id,
    environment: node.environment,
    capabilities: node.capabilities || [],
    runtime_version: node.runtime_version || 'unknown',
    state: node.state || 'discovered',
    health: node.health || 'unknown',
    last_seen_at: node.last_seen_at || null,
    revision: node.revision || null,
    security_posture: node.security_posture || 'unknown',
    registered_at: node.registered_at || null,
    desired_workload: node.desired_workload || null,
    metadata: node.metadata || {}
  };
}

export function createSupabaseNodeStore({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, schema = 'one', fetchImpl = globalThis.fetch } = {}) {
  const base = cleanBase(url);
  const secret = String(key || '').trim();
  const available = Boolean(base && secret && typeof fetchImpl === 'function');
  const nodes = `${base}/rest/v1/node_registry`;
  const events = `${base}/rest/v1/node_events`;

  async function request(target, options = {}) {
    if (!available) return { ok: false, status: 503, reason: 'supabase_node_store_not_configured', body: null };
    try {
      const response = await fetchImpl(target, { ...options, headers: { ...headersFor(schema, secret, Boolean(options.method && options.method !== 'GET')), ...(options.headers || {}) }, signal: options.signal || AbortSignal.timeout(5000) });
      const text = await response.text();
      return { ok: response.ok, status: response.status, reason: response.ok ? null : 'supabase_request_failed', body: parseResponseBody(text) };
    } catch (error) {
      return { ok: false, status: 502, reason: 'supabase_unreachable', body: null, error: error?.message || String(error) };
    }
  }

  return {
    contract: { available, persistence: 'supabase', schema, sideEffects: 'explicit_adapter_only', secretConfigured: Boolean(secret) },
    async read(nodeId) {
      const id = encodeURIComponent(String(nodeId || '').trim());
      if (!id) return { ok: false, reason: 'node_id_required', sideEffects: false };
      const result = await request(`${nodes}?select=*&node_id=eq.${id}&limit=1`);
      if (!result.ok) return { ok: false, reason: result.reason, status: result.status, sideEffects: false };
      return { ok: true, node: result.body?.[0] || null, sideEffects: false };
    },
    async listReady() {
      const result = await request(`${nodes}?select=*&state=eq.ready&health=eq.healthy&security_posture=eq.ready&order=node_id.asc`);
      if (!result.ok) return { ok: false, reason: result.reason, status: result.status, sideEffects: false };
      return { ok: true, nodes: Array.isArray(result.body) ? result.body : [], sideEffects: false };
    },
    async upsert(node) {
      const row = rowFromNode(node);
      const result = await request(nodes, { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
      return result.ok ? { ok: true, node: row, sideEffects: true } : { ok: false, reason: result.reason, status: result.status, sideEffects: false };
    },
    async appendEvent(event = {}) {
      const row = { node_id: String(event.node_id || '').trim(), event_type: event.event_type || 'node.event', correlation_id: event.correlation_id || null, payload: event.payload || {} };
      if (!row.node_id) return { ok: false, reason: 'node_id_required', sideEffects: false };
      const result = await request(events, { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(row) });
      return result.ok ? { ok: true, sideEffects: true } : { ok: false, reason: result.reason, status: result.status, sideEffects: false };
    }
  };
}
