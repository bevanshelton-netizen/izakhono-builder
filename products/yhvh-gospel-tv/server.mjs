import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const dataDir = process.env.YHVH_DATA_DIR || path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'state.json');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const controlToken = process.env.YHVH_CONTROL_TOKEN || '';
const liveUrl = process.env.YHVH_LIVE_URL || '';
const stationName = 'YHVH GOSPEL TV';

fs.mkdirSync(dataDir, { recursive: true });

const seed = {
  automation: true,
  emergency: false,
  startedAt: new Date().toISOString(),
  currentIndex: 0,
  submissions: [],
  events: [],
  sponsorSlots: [],
  audit: []
};

function loadState() {
  try { return { ...seed, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) }; }
  catch { fs.writeFileSync(stateFile, JSON.stringify(seed, null, 2)); return structuredClone(seed); }
}
function saveState(state) { fs.writeFileSync(stateFile, JSON.stringify(state, null, 2)); }
let state = loadState();

const schedule = [
  ['00:00','Midnight Worship','Worship','en'],
  ['02:00','Scripture Through the Night','Word','en'],
  ['04:00','Quiet Hour','Worship','mul'],
  ['05:00','Morning Glory','Worship','en'],
  ['07:00','Gospel Africa AM','Magazine','en'],
  ['09:00','Women of Faith','Teaching','en'],
  ['10:00','The Word','Teaching','en'],
  ['12:00','Word at Noon','Teaching','mul'],
  ['13:00','Choirs of Africa','Music','mul'],
  ['15:00','Faith Without Borders','Magazine','mul'],
  ['16:00','Gospel Kids','Family','en'],
  ['17:00','Young & Faithful','Youth','en'],
  ['18:00','Testimony Hour','Testimony','mul'],
  ['19:00','Prime Gospel','Music','en'],
  ['20:00','Revival Nights','Event','mul'],
  ['22:00','Late Night Praise','Worship','mul']
].map(([time,title,genre,language]) => ({ time, title, genre, language }));

function minutesNow() { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
function slotMinutes(t) { const [h,m] = t.split(':').map(Number); return h * 60 + m; }
function currentSchedule() {
  const now = minutesNow();
  let idx = schedule.findIndex((s, i) => now >= slotMinutes(s.time) && (i === schedule.length - 1 || now < slotMinutes(schedule[i + 1].time)));
  if (idx < 0) idx = schedule.length - 1;
  const current = schedule[idx];
  const next = schedule[(idx + 1) % schedule.length];
  return { current, next, index: idx };
}

function json(res, status, body) {
  const out = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer'
  });
  res.end(out);
}
function html(res, file) {
  const filePath = path.join(publicDir, file);
  if (!filePath.startsWith(publicDir)) return json(res, 400, { error: 'bad_path' });
  try {
    const body = fs.readFileSync(filePath);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
    res.end(body);
  } catch { json(res, 404, { error: 'not_found' }); }
}
function authorized(req) {
  if (!controlToken) return false;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  return supplied.length > 0 && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(controlToken));
}
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length > 32768) throw new Error('payload_too_large');
  return raw ? JSON.parse(raw) : {};
}
function audit(action, meta = {}) {
  state.audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), action, ...meta });
  state.audit = state.audit.slice(0, 200);
  saveState(state);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const p = url.pathname;

    if (req.method === 'GET' && p === '/health') {
      return json(res, 200, { ok: true, service: 'yhvh-gospel-tv', runtime: 'izakhono-owned', station: stationName, time: new Date().toISOString() });
    }
    if (req.method === 'GET' && p === '/api/status') {
      const { current, next, index } = currentSchedule();
      return json(res, 200, {
        ok: true, station: stationName, tagline: 'FAITH. WORSHIP. WORD. — AFRICA TO THE WORLD.',
        automation: state.automation, emergency: state.emergency,
        live: Boolean(liveUrl), liveUrl: liveUrl || null,
        current, next, index, scheduleCount: schedule.length,
        submissions: state.submissions.length, events: state.events.length,
        serverTime: new Date().toISOString()
      });
    }
    if (req.method === 'GET' && p === '/api/schedule') return json(res, 200, { ok: true, schedule });
    if (req.method === 'GET' && p === '/api/now') return json(res, 200, { ok: true, ...currentSchedule() });
    if (req.method === 'GET' && p === '/api/live') return json(res, 200, { ok: true, configured: Boolean(liveUrl), url: liveUrl || null });

    if (p.startsWith('/api/control/')) {
      if (!authorized(req)) return json(res, 401, { ok: false, error: 'owner_authorization_required' });
      if (req.method === 'GET' && p === '/api/control/state') {
        return json(res, 200, { ok: true, state: { automation: state.automation, emergency: state.emergency }, audit: state.audit.slice(0, 30) });
      }
      if (req.method === 'POST' && p === '/api/control/automation') {
        const b = await body(req); state.automation = Boolean(b.enabled); audit('automation_changed', { enabled: state.automation });
        return json(res, 200, { ok: true, automation: state.automation });
      }
      if (req.method === 'POST' && p === '/api/control/emergency') {
        const b = await body(req); state.emergency = Boolean(b.enabled); audit('emergency_slate_changed', { enabled: state.emergency });
        return json(res, 200, { ok: true, emergency: state.emergency });
      }
      if (req.method === 'POST' && p === '/api/control/submission') {
        const b = await body(req);
        const item = { id: `YGV-${Date.now()}`, at: new Date().toISOString(), name: String(b.name || '').slice(0,120), title: String(b.title || '').slice(0,160), language: String(b.language || 'und').slice(0,16), status: 'SUBMITTED' };
        state.submissions.unshift(item); saveState(state); audit('submission_created', { id: item.id });
        return json(res, 201, { ok: true, item });
      }
      return json(res, 404, { ok: false, error: 'control_route_not_found' });
    }

    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return html(res, 'index.html');
    if (req.method === 'GET' && p === '/control') return html(res, 'control.html');
    if (req.method === 'GET' && p === '/creator') return html(res, 'creator.html');

    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    return json(res, 400, { ok: false, error: err?.message || 'bad_request' });
  }
});

server.listen(port, host, () => console.log(`${stationName} engine listening on http://${host}:${port}`));
