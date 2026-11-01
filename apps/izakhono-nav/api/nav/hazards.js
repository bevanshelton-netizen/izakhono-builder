const MAX_BYTES = 500000;
const STALE_HOURS = 24;
const VALID_TYPES = new Set([
  'flooding','pothole','road_closure','collision','crime_hotspot',
  'civil_disruption','poor_lighting','weather_visibility',
  'animal_crossing','road_surface'
]);

const seed = {
  version: '0.1',
  generated_at: new Date().toISOString(),
  source: 'IZAKHONO NAV HAZARD GATEWAY',
  status: 'UNCONFIGURED',
  records: []
};

function valid(record, now) {
  if (!record || !record.id || !VALID_TYPES.has(record.type)) return false;
  if (!Number.isFinite(Number(record.lat)) || !Number.isFinite(Number(record.lon))) return false;
  if (!Number.isFinite(Number(record.severity)) || !record.source || !record.timestamp) return false;
  const t = Date.parse(record.timestamp);
  return Number.isFinite(t) && now >= t && now - t <= STALE_HOURS * 3600000;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // The gateway is intentionally empty until an approved source is configured.
  // Never manufacture incidents or accept unverified data into navigation safety scoring.
  const now = Date.now();
  const records = seed.records.filter(r => valid(r, now));
  const body = JSON.stringify({ ...seed, generated_at: new Date().toISOString(), records });

  if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Hazard gateway payload exceeds safety limit' }));
  }

  res.statusCode = 200;
  return res.end(body);
};
