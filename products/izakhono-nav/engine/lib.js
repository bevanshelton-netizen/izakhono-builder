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
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { 'user-agent': 'IZAKHONO-NAV-ENGINE/1.1', accept: 'application/json', ...(init.headers || {}) } });
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

export function decodePolyline(encoded, precision = 6) {
  if (!encoded) return [];
  const coordinates = [];
  let index = 0, lat = 0, lng = 0;
  const factor = 10 ** precision;
  while (index < encoded.length) {
    let result = 0, shift = 0, b;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && index <= encoded.length);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && index <= encoded.length);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
}

function valhallaStep(m, coordinates) {
  const begin = Math.max(0, Number(m.begin_shape_index || 0));
  const end = Math.min(coordinates.length - 1, Number(m.end_shape_index ?? begin));
  const geometry = coordinates.slice(begin, Math.max(begin + 1, end + 1));
  const location = coordinates[begin] || coordinates[0] || [0, 0];
  return {
    distance: Math.round(Number(m.length || 0) * 1000),
    duration: Number(m.time || 0),
    name: Array.isArray(m.street_names) ? (m.street_names[0] || '') : '',
    instruction: m.instruction || m.verbal_pre_transition_instruction || '',
    geometry: { type: 'LineString', coordinates: geometry },
    maneuver: { type: begin === 0 ? 'depart' : (m.type === 4 || m.type === 5 ? 'arrive' : 'turn'), location },
  };
}

export async function routeRequest(start, end, profile = 'driving') {
  const owned = config.routing.url;
  const fallback = config.resilienceAllowed ? config.routing.resilienceUrl : '';
  const base = owned || fallback;
  if (!base) return { error: 'routing_unavailable', status: 503, detail: 'No approved routing backend is configured.' };
  const source = owned ? 'owned' : 'resilience';

  if (config.routing.kind === 'osrm') {
    const p = profile === 'walking' ? 'foot' : profile === 'cycling' ? 'bike' : 'driving';
    const url = `${base}/route/v1/${p}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`;
    const data = await fetchJson(url);
    const route = data.routes?.[0];
    if (!route) return { error: 'route_not_found', status: 404 };
    return { source, engine: 'osrm', ...route };
  }

  const payload = {
    locations: [{ lat: start.lat, lon: start.lng }, { lat: end.lat, lon: end.lng }],
    costing: valhallaProfile(profile),
    units: 'kilometers',
    language: 'en-US',
    directions_options: { units: 'kilometers' }
  };
  const data = await fetchJson(`${base}/route`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const trip = data.trip;
  if (!trip) return { error: 'route_not_found', status: 404 };
  const coordinates = decodePolyline(trip.legs?.[0]?.shape || '', 6);
  const legs = (trip.legs || []).map(leg => ({
    distance: Math.round(Number(leg.summary?.length || 0) * 1000),
    duration: Number(leg.summary?.time || 0),
    steps: (leg.maneuvers || []).map(m => valhallaStep(m, coordinates)),
  }));
  return {
    source,
    engine: 'valhalla',
    distance: Math.round(Number(trip.summary?.length || 0) * 1000),
    duration: Number(trip.summary?.time || 0),
    geometry: { type: 'LineString', coordinates },
    legs,
  };
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
    display_name: item.display_name || item.name || '',
    lat: Number(item.lat),
    lng: Number(item.lon),
    lon: Number(item.lon),
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

async function simpleHealth(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'IZAKHONO-NAV-ENGINE/1.1' } });
    if (!r.ok) return { ready: false, status: r.status };
    const text = await r.text();
    let body = null; try { body = JSON.parse(text); } catch {}
    if (body && typeof body.status === 'number' && body.status !== 0) return { ready: false, status: r.status };
    return { ready: true, status: r.status };
  } catch { return { ready: false }; }
  finally { clearTimeout(timer); }
}

export async function dependencyHealth() {
  const checks = {};
  if (config.routing.url) checks.routing = { configured: true, ...(await simpleHealth(`${config.routing.url}/status`)) };
  else checks.routing = { configured: false, ready: false };

  if (config.search.url) checks.search = { configured: true, ...(await simpleHealth(`${config.search.url}/status?format=json`)) };
  else checks.search = { configured: false, ready: false };

  if (config.tiles.template) {
    try {
      const tileUrl = new URL(config.tiles.template.replace('{z}','0').replace('{x}','0').replace('{y}','0'));
      checks.tiles = { configured: true, ...(await simpleHealth(`${tileUrl.origin}/catalog`)) };
    } catch { checks.tiles = { configured: true, ready: false }; }
  } else checks.tiles = { configured: false, ready: false };
  return checks;
}
