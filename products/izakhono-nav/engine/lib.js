import { config } from './config.js';

export function json(data, status = 200, extra = {}) {
  return { status, body: JSON.stringify(data), headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } };
}

export function parsePoint(value) {
  const [lng, lat] = String(value || '').split(',').map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return { lng, lat };
}

export function clientId(req) {
  if (config.trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

const buckets = new Map();
export function rateAllowed(id, now = Date.now()) {
  const key = String(id || 'unknown');
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= config.rateLimit.windowMs) bucket = { start: now, count: 0 };
  bucket.count += 1;
  buckets.set(key, bucket);
  return bucket.count <= config.rateLimit.max;
}

export async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { 'user-agent': 'IZAKHONO-NAV-ENGINE/1.0', accept: 'application/json', ...(init.headers || {}) } });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 1000) }; }
    if (!response.ok) throw Object.assign(new Error(`Upstream ${response.status}`), { status: response.status, data });
    return data;
  } finally { clearTimeout(timer); }
}

function valhallaProfile(profile) {
  return profile === 'walking' ? 'pedestrian' : profile === 'cycling' ? 'bicycle' : profile === 'truck' ? 'truck' : 'auto';
}

export async function routeRequest(start, end, profile = 'driving') {
  const owned = config.routing.url;
  const fallback = config.resilienceAllowed ? config.routing.resilienceUrl : '';
  const base = owned || fallback;
  if (!base) return { error: 'routing_unavailable', status: 503, detail: 'No approved routing backend is configured.' };
  const source = owned ? 'owned' : 'resilience';

  if (config.routing.kind === 'osrm') {
    const p = profile === 'walking' ? 'foot' : profile === 'cycling' ? 'bike' : 'driving';
    const url = `${base}/route/v1/${p}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;
    const data = await fetchJson(url);
    const route = data.routes?.[0];
    if (!route) return { error: 'route_not_found', status: 404 };
    return { source, engine: 'osrm', distanceMeters: route.distance, durationSeconds: route.duration, geometry: route.geometry, legs: route.legs || [] };
  }

  const payload = { locations: [{ lat: start.lat, lon: start.lng }, { lat: end.lat, lon: end.lng }], costing: valhallaProfile(profile), units: 'kilometers', language: 'en-US', directions_options: { units: 'kilometers' } };
  const data = await fetchJson(`${base}/route`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const trip = data.trip;
  if (!trip) return { error: 'route_not_found', status: 404 };
  return { source, engine: 'valhalla', distanceMeters: Math.round((trip.summary?.length || 0) * 1000), durationSeconds: trip.summary?.time || 0, shape: trip.legs?.[0]?.shape || null, legs: trip.legs || [] };
}

export async function searchRequest(query, limit = 5, lat = null, lng = null) {
  const owned = config.search.url;
  const fallback = config.resilienceAllowed ? config.search.resilienceUrl : '';
  const base = owned || fallback;
  if (!base) return { error: 'search_unavailable', status: 503, detail: 'No approved search backend is configured.' };
  const source = owned ? 'owned' : 'resilience';

  const url = new URL(base.includes('/search') ? base : `${base}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(Math.max(1, Math.min(20, Number(limit) || 5))));
  url.searchParams.set('addressdetails', '1');
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const d = 0.5;
    url.searchParams.set('viewbox', `${lng-d},${lat+d},${lng+d},${lat-d}`);
    url.searchParams.set('bounded', '0');
  }
  const data = await fetchJson(url);
  const results = (Array.isArray(data) ? data : []).map(item => ({
    id: String(item.place_id || item.osm_id || ''),
    name: item.display_name || item.name || '',
    lat: Number(item.lat),
    lng: Number(item.lon),
    type: item.type || item.category || null,
    address: item.address || null,
  })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng));
  return { source, engine: 'nominatim', results };
}

export function tileTarget(z, x, y) {
  const owned = config.tiles.template;
  const fallback = config.resilienceAllowed ? config.tiles.resilienceTemplate : '';
  const template = owned || fallback;
  if (!template) return null;
  return { source: owned ? 'owned' : 'resilience', url: template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)) };
}

export async function dependencyHealth() {
  const checks = {};
  for (const [name, base] of [['routing', config.routing.url], ['search', config.search.url]]) {
    if (!base) { checks[name] = { configured: false, ready: false }; continue; }
    try {
      const u = new URL(base);
      u.pathname = u.pathname.replace(/\/$/, '') + (name === 'routing' && config.routing.kind === 'valhalla' ? '/status' : '/status.php');
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 1500);
      let r;
      try { r = await fetch(u, { signal: c.signal, headers: { 'user-agent': 'IZAKHONO-NAV-ENGINE/1.0' } }); } finally { clearTimeout(t); }
      checks[name] = { configured: true, ready: r.ok, status: r.status };
    } catch { checks[name] = { configured: true, ready: false }; }
  }
  checks.tiles = { configured: Boolean(config.tiles.template), ready: Boolean(config.tiles.template) };
  return checks;
}
