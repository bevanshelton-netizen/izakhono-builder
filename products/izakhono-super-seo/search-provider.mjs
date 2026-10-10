import { URL } from 'node:url';

// Compatibility shim for server.mjs: Node ESM has no native __filename,
// while the V5 server uses it only to distinguish direct execution from imports.
globalThis.__filename = process.argv[1] || '';

export function providerStatus(env = process.env) {
  const url = env.SEARCH_PROVIDER_URL || '';
  return {
    configured: Boolean(url && env.SEARCH_PROVIDER_TOKEN),
    name: env.SEARCH_PROVIDER_NAME || (url ? 'configured-provider' : 'unconfigured'),
    capabilities: ['serp_results', 'competitor_presence', 'opportunity_scoring'],
  };
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizeSearchResult(payload, query, source = 'provider') {
  const rows = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload) ? payload : [];
  const results = rows.map((row, index) => {
    const position = finiteNumber(row.position) ?? index + 1;
    return {
      position,
      title: typeof row.title === 'string' ? row.title : '',
      url: typeof row.url === 'string' ? row.url : '',
      domain: typeof row.domain === 'string' ? row.domain : (() => { try { return new URL(row.url).hostname; } catch { return ''; } })(),
      ...(typeof row.snippet === 'string' ? { snippet: row.snippet } : {}),
    };
  }).filter((row) => row.url);
  const metrics = {};
  for (const key of ['search_volume', 'cpc', 'competition', 'difficulty']) {
    const value = finiteNumber(payload?.metrics?.[key]);
    if (value !== undefined) metrics[key] = value;
  }
  return { query, source, fetched_at: new Date().toISOString(), results, ...(Object.keys(metrics).length ? { metrics } : {}) };
}
export async function searchKeyword(query, options = {}, env = process.env) {
  const status = providerStatus(env);
  if (!status.configured) return { query, source: 'unconfigured', status: 'not_configured', results: [] };
  const endpoint = new URL(env.SEARCH_PROVIDER_URL);
  if (endpoint.protocol !== 'https:') throw new Error('SEARCH_PROVIDER_URL must use HTTPS');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  try {
    const response = await fetch(endpoint, {method: 'POST',headers: { 'content-type': 'application/json', authorization: `Bearer ${env.SEARCH_PROVIDER_TOKEN}` },body: JSON.stringify({ query, locale: options.locale || 'en-ZA', country: options.country || 'ZA', language: options.language || 'en', max_results: options.maxResults || 10 }),signal: controller.signal});
    if (!response.ok) throw new Error(`search provider returned HTTP ${response.status}`);
    const payload = await response.json(); return { status: 'ok', ...normalizeSearchResult(payload, query, status.name) };
  } finally { clearTimeout(timer); }
}
export async function searchBatch(queries, options = {}, env = process.env) {
  const unique = [...new Set((queries || []).filter((q) => typeof q === 'string').map((q) => q.trim()).filter(Boolean))].slice(0, options.maxQueries || 25);
  const status = providerStatus(env);
  if (!status.configured) return { provider_status: 'not_configured', provider: status.name, results: unique.map((query) => searchKeyword(query, options, env)) };
  const results = [];
  for (const query of unique) results.push(await searchKeyword(query, options, env));
  return { provider_status: 'connected', provider: status.name, results };
}
