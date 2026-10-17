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

export function createSupabaseSearchStore({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, schema = 'one', fetchImpl = globalThis.fetch } = {}) {
  const base = cleanBase(url);
  const secret = String(key || '').trim();
  const available = Boolean(base && secret && typeof fetchImpl === 'function');
  const snapshots = `${base}/rest/v1/search_index_snapshots`;
  const events = `${base}/rest/v1/search_index_events`;

  async function request(target, options = {}) {
    if (!available) return { ok: false, status: 503, reason: 'supabase_search_store_not_configured', body: null };
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
    async readSnapshot() {
      const result = await request(`${snapshots}?select=version,generated_at,provider,records,content_hash,entries&order=version.desc&limit=1`);
      if (!result.ok) return { ok: false, reason: result.reason, status: result.status, sideEffects: false };
      return { ok: true, snapshot: result.body?.[0] || null, sideEffects: false };
    },
    async writeSnapshot(snapshot, expectedVersion = null) {
      const current = await this.readSnapshot();
      if (!current.ok) return { ok: false, reason: current.reason, status: current.status, sideEffects: false };
      const currentVersion = Number(current.snapshot?.version || 0);
      if (expectedVersion !== null && currentVersion !== Number(expectedVersion)) return { ok: false, reason: 'version_conflict', currentVersion, sideEffects: false };
      const row = { version: Number(snapshot.version), generated_at: snapshot.generated_at, provider: snapshot.provider || 'owned', records: Number(snapshot.records || snapshot.entries?.length || 0), content_hash: snapshot.content_hash, entries: snapshot.entries || [] };
      const result = await request(snapshots, { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(row) });
      if (result.ok) return { ok: true, version: row.version, content_hash: row.content_hash, sideEffects: true };
      if (result.status === 409 || result.status === 400) return { ok: false, reason: 'snapshot_write_conflict_or_rejected', status: result.status, sideEffects: false };
      return { ok: false, reason: result.reason, status: result.status, sideEffects: false };
    },
    async appendEvent(event) {
      const row = { event_type: event.type || 'search.index.event', version: event.version ?? null, correlation_id: event.correlation_id || null, delta: event.delta || {}, content_hash: event.content_hash || null };
      const result = await request(events, { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(row) });
      return result.ok ? { ok: true, sideEffects: true } : { ok: false, reason: result.reason, status: result.status, sideEffects: false };
    }
  };
}
