const csv = (value) => String(value || '').split(',').map(v => v.trim()).filter(Boolean);
const bool = (value, fallback = false) => value == null || value === '' ? fallback : /^(1|true|yes|on)$/i.test(String(value));
const int = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const config = Object.freeze({
  product: 'IZAKHONO NAV ENGINE',
  version: '1.1.0',
  releaseId: process.env.NAV_RELEASE_ID || 'IZAKHONO-NAV-ENGINE-v1.1.0',
  runtimeId: process.env.NAV_RUNTIME_ID || process.env.HOSTNAME || 'NAV-RUNTIME-LOCAL',
  runtimeClass: process.env.NAV_RUNTIME_CLASS || 'owned',
  host: process.env.HOST || '0.0.0.0',
  port: int(process.env.PORT, 8788),
  allowedOrigins: csv(process.env.NAV_ALLOWED_ORIGINS),
  trustProxy: bool(process.env.NAV_TRUST_PROXY, false),
  resilienceAllowed: bool(process.env.NAV_ALLOW_RESILIENCE, false),
  requestTimeoutMs: int(process.env.NAV_REQUEST_TIMEOUT_MS, 8000),
  rateLimit: {
    windowMs: int(process.env.NAV_RATE_WINDOW_MS, 60_000),
    max: int(process.env.NAV_RATE_MAX, 120),
  },
  routing: {
    kind: (process.env.NAV_ROUTER_KIND || 'valhalla').toLowerCase(),
    url: String(process.env.NAV_ROUTER_URL || '').replace(/\/$/, ''),
    resilienceUrl: String(process.env.NAV_ROUTER_RESILIENCE_URL || '').replace(/\/$/, ''),
  },
  search: {
    kind: (process.env.NAV_SEARCH_KIND || 'nominatim').toLowerCase(),
    url: String(process.env.NAV_SEARCH_URL || '').replace(/\/$/, ''),
    resilienceUrl: String(process.env.NAV_SEARCH_RESILIENCE_URL || '').replace(/\/$/, ''),
  },
  tiles: {
    template: process.env.NAV_TILE_TEMPLATE || '',
    resilienceTemplate: process.env.NAV_TILE_RESILIENCE_TEMPLATE || '',
  },
});
