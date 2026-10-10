import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8788);
const DATA_DIR = process.env.ALLEGRO_DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'allegro.json');
const SUPABASE_API = process.env.ALLEGRO_SUPABASE_API || '';
const SUPABASE_GROWTH = process.env.ALLEGRO_SUPABASE_GROWTH || '';
const ALLEGRO_VERSION = 'owned-core-1.0';

fs.mkdirSync(DATA_DIR, { recursive: true });

function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { bookings: [], leads: [], events: [] }; }
}
let state = load();
function persist() {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  return JSON.parse(raw);
}
async function adapter(url, payload) {
  if (!url) return { ok: false, skipped: true, reason: 'adapter-not-configured' };
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(7000) });
    const text = await r.text();
    return { ok: r.ok, status: r.status, body: text.slice(0, 4000) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function bookingCode() { return `ALG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }
function event(type, data) { state.events.push({ id: crypto.randomUUID(), type, at: new Date().toISOString(), data }); persist(); }

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
        supabaseAdapter: Boolean(SUPABASE_API),
        growthAdapter: Boolean(SUPABASE_GROWTH),
        time: new Date().toISOString()
      });
    }
    if (req.method === 'GET' && url.pathname === '/health/dependencies') {
      const checks = { localPersistence: true, studioAdapterConfigured: Boolean(SUPABASE_API), growthAdapterConfigured: Boolean(SUPABASE_GROWTH) };
      return json(res, 200, { ok: true, mode: 'owned-first', checks });
    }
    if (req.method === 'POST' && url.pathname === '/api/bookings') {
      const input = await body(req);
      if (!input.name || !input.mobile || !input.service) return json(res, 400, { ok: false, error: 'name, mobile and service are required' });
      const booking = { id: crypto.randomUUID(), code: bookingCode(), status: 'received', createdAt: new Date().toISOString(), ...input };
      state.bookings.push(booking); persist();
      event('booking.received', { bookingId: booking.id, code: booking.code });
      const external = await adapter(SUPABASE_API, { action: 'booking.received', booking });
      return json(res, 201, { ok: true, booking, externalAdapter: external.ok ? 'acknowledged' : 'non-blocking-fallback' });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/bookings/')) {
      const code = decodeURIComponent(url.pathname.split('/').pop());
      const booking = state.bookings.find(b => b.code === code || b.id === code);
      return booking ? json(res, 200, { ok: true, booking }) : json(res, 404, { ok: false, error: 'booking-not-found' });
    }
    if (req.method === 'POST' && url.pathname === '/api/growth') {
      const input = await body(req);
      if (!input.email && !input.mobile) return json(res, 400, { ok: false, error: 'email or mobile is required' });
      const lead = { id: crypto.randomUUID(), status: 'received', createdAt: new Date().toISOString(), ...input };
      state.leads.push(lead); persist();
      event('growth.lead.received', { leadId: lead.id });
      const external = await adapter(SUPABASE_GROWTH, { action: 'lead.received', lead });
      return json(res, 201, { ok: true, lead, externalAdapter: external.ok ? 'acknowledged' : 'non-blocking-fallback' });
    }
    if (req.method === 'POST' && url.pathname === '/api/payment/webhook') {
      const input = await body(req);
      event('payment.webhook.received', { provider: input.provider || 'unknown', reference: input.reference || input.payment_reference || null });
      return json(res, 202, { ok: true, accepted: true, mode: 'owned-event-log', provider: input.provider || 'unknown' });
    }
    if (req.method === 'POST' && url.pathname === '/api/selftest') {
      const booking = { name: 'Allegro Runtime Test', mobile: '+27000000000', service: 'selftest' };
      state.bookings.push({ id: crypto.randomUUID(), code: bookingCode(), status: 'selftest', createdAt: new Date().toISOString(), ...booking });
      persist();
      return json(res, 200, { ok: true, persistence: fs.existsSync(DB_FILE), bookings: state.bookings.length });
    }
    return json(res, 404, { ok: false, error: 'not-found' });
  } catch (error) {
    return json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Allegro Core listening on ${PORT}`));
