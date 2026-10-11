import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8788);
const DATA_DIR = process.env.ALLEGRO_DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'allegro.json');
const MAX_BODY_BYTES = Number(process.env.ALLEGRO_MAX_BODY_BYTES || 1024 * 1024);
const WEBHOOK_TOKEN = process.env.ALLEGRO_WEBHOOK_TOKEN || '';
const INTERNAL_TOKEN = process.env.ALLEGRO_INTERNAL_TOKEN || '';
const SUPABASE_API = process.env.ALLEGRO_SUPABASE_API || '';
const SUPABASE_GROWTH = process.env.ALLEGRO_SUPABASE_GROWTH || '';
const ALLEGRO_VERSION = 'owned-core-1.1';

fs.mkdirSync(DATA_DIR, { recursive: true });

function emptyState() { return { bookings: [], leads: [], events: [], paymentWebhooks: [] }; }
function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}
let state = load();

function persist() {
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify(body));
}

async function body(req) {
  let raw = '';
  let bytes = 0;
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > MAX_BODY_BYTES) {
      const error = new Error('request-body-too-large');
      error.statusCode = 413;
      throw error;
    }
    raw += chunk;
  }
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch {
    const error = new Error('invalid-json');
    error.statusCode = 400;
    throw error;
  }
}

async function adapter(url, payload) {
  if (!url) return { ok: false, skipped: true, reason: 'adapter-not-configured' };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(7000)
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, body: text.slice(0, 4000) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function bookingCode() { return `ALG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }
function event(type, data) {
  state.events.push({ id: crypto.randomUUID(), type, at: new Date().toISOString(), data });
  persist();
}
function requireInternal(req) {
  if (!INTERNAL_TOKEN) return false;
  return req.headers['x-allegro-internal-token'] === INTERNAL_TOKEN;
}
function requireWebhook(req) {
  if (!WEBHOOK_TOKEN) return true;
  return req.headers['x-allegro-webhook-token'] === WEBHOOK_TOKEN;
}
function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : value;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'allegro-core',
        version: ALLEGRO_VERSION,
        mode: 'owned-first',
        persistence: 'local-durable-file',
        bookings: state.bookings.length,
        growthLeads: state.leads.length,
        paymentEvents: state.paymentWebhooks.length,
        supabaseAdapter: Boolean(SUPABASE_API),
        growthAdapter: Boolean(SUPABASE_GROWTH),
        webhookProtection: Boolean(WEBHOOK_TOKEN),
        time: new Date().toISOString()
      });
    }

    if (req.method === 'GET' && url.pathname === '/health/dependencies') {
      return json(res, 200, {
        ok: true,
        mode: 'owned-first',
        checks: {
          localPersistence: fs.existsSync(DATA_DIR),
          studioAdapterConfigured: Boolean(SUPABASE_API),
          growthAdapterConfigured: Boolean(SUPABASE_GROWTH)
        }
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/bookings') {
      const input = await body(req);
      const name = cleanText(input.name, 120);
      const mobile = cleanText(input.mobile, 40);
      const service = cleanText(input.service, 120);
      if (!name || !mobile || !service) return json(res, 400, { ok: false, error: 'name, mobile and service are required' });
      const booking = {
        id: crypto.randomUUID(), code: bookingCode(), status: 'received',
        createdAt: new Date().toISOString(), name, mobile, service,
        message: cleanText(input.message, 1000) || null
      };
      state.bookings.push(booking);
      persist();
      event('booking.received', { bookingId: booking.id, code: booking.code });
      const external = await adapter(SUPABASE_API, { action: 'booking.received', booking });
      return json(res, 201, { ok: true, booking, externalAdapter: external.ok ? 'acknowledged' : 'non-blocking-fallback' });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/bookings/')) {
      const code = decodeURIComponent(url.pathname.split('/').pop() || '');
      const booking = state.bookings.find(b => b.code === code || b.id === code);
      return booking ? json(res, 200, { ok: true, booking }) : json(res, 404, { ok: false, error: 'booking-not-found' });
    }

    if (req.method === 'POST' && url.pathname === '/api/growth') {
      const input = await body(req);
      const email = cleanText(input.email, 254);
      const mobile = cleanText(input.mobile, 40);
      if (!email && !mobile) return json(res, 400, { ok: false, error: 'email or mobile is required' });
      const lead = {
        id: crypto.randomUUID(), status: 'received', createdAt: new Date().toISOString(),
        name: cleanText(input.name, 120) || null, email: email || null, mobile: mobile || null,
        source: cleanText(input.source, 120) || 'allegro', message: cleanText(input.message, 1000) || null
      };
      state.leads.push(lead);
      persist();
      event('growth.lead.received', { leadId: lead.id });
      const external = await adapter(SUPABASE_GROWTH, { action: 'lead.received', lead });
      return json(res, 201, { ok: true, lead, externalAdapter: external.ok ? 'acknowledged' : 'non-blocking-fallback' });
    }

    if (req.method === 'POST' && url.pathname === '/api/payment/webhook') {
      if (!requireWebhook(req)) return json(res, 401, { ok: false, error: 'invalid-webhook-token' });
      const input = await body(req);
      const reference = cleanText(input.reference || input.payment_reference, 200);
      if (!reference) return json(res, 400, { ok: false, error: 'payment reference is required' });
      const existing = state.paymentWebhooks.find(p => p.reference === reference);
      if (existing) return json(res, 200, { ok: true, accepted: true, duplicate: true, eventId: existing.eventId });
      const eventId = crypto.randomUUID();
      const record = {
        eventId, reference, provider: cleanText(input.provider, 80) || 'unknown',
        status: cleanText(input.status, 80) || 'unknown', receivedAt: new Date().toISOString()
      };
      state.paymentWebhooks.push(record);
      event('payment.webhook.received', record);
      return json(res, 202, { ok: true, accepted: true, duplicate: false, mode: 'owned-event-log', eventId, provider: record.provider });
    }

    if (req.method === 'POST' && url.pathname === '/api/selftest') {
      if (!requireInternal(req)) return json(res, 404, { ok: false, error: 'not-found' });
      const record = { id: crypto.randomUUID(), code: bookingCode(), status: 'selftest', createdAt: new Date().toISOString(), name: 'Allegro Runtime Test', mobile: '+27000000000', service: 'selftest' };
      state.bookings.push(record);
      persist();
      return json(res, 200, { ok: true, persistence: fs.existsSync(DB_FILE), bookings: state.bookings.length });
    }

    return json(res, 404, { ok: false, error: 'not-found' });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    return json(res, status, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Allegro Core listening on ${PORT}`));
