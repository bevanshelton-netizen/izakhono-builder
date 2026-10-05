import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPlayoutEngine } from './playout/playout-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const dataDir = process.env.YHVH_DATA_DIR || path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'state.json');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const controlToken = process.env.YHVH_CONTROL_TOKEN || '';
const liveUrl = process.env.YHVH_LIVE_URL || '';
const stationName = 'YHVH GOSPEL TV';
const intakeWindowMs = 60 * 60 * 1000;
const intakeLimit = 12;
const intakeHits = new Map();

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
function saveState(nextState) { fs.writeFileSync(stateFile, JSON.stringify(nextState, null, 2)); }
let state = loadState();

const playout = createPlayoutEngine({
  manifestPath: path.join(__dirname, 'playout', 'playlist.json'),
  vaultDir: process.env.YHVH_CONTENT_VAULT || path.join(__dirname, 'content-vault')
});

const schedule = [
  ['00:00','Midnight Worship','Worship','en'], ['02:00','Scripture Through the Night','Word','en'],
  ['04:00','Quiet Hour','Worship','mul'], ['05:00','Morning Glory','Worship','en'],
  ['07:00','Gospel Africa AM','Magazine','en'], ['09:00','Women of Faith','Teaching','en'],
  ['10:00','The Word','Teaching','en'], ['12:00','Word at Noon','Teaching','mul'],
  ['13:00','Choirs of Africa','Music','mul'], ['15:00','Faith Without Borders','Magazine','mul'],
  ['16:00','Gospel Kids','Family','en'], ['17:00','Young & Faithful','Youth','en'],
  ['18:00','Testimony Hour','Testimony','mul'], ['19:00','Prime Gospel','Music','en'],
  ['20:00','Revival Nights','Event','mul'], ['22:00','Late Night Praise','Worship','mul']
].map(([time,title,genre,language]) => ({ time, title, genre, language }));

function minutesNow() { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
function slotMinutes(t) { const [h,m] = t.split(':').map(Number); return h * 60 + m; }
function currentSchedule() {
  const now = minutesNow();
  let idx = schedule.findIndex((s, i) => now >= slotMinutes(s.time) && (i === schedule.length - 1 || now < slotMinutes(schedule[i + 1].time)));
  if (idx < 0) idx = schedule.length - 1;
  return { current: schedule[idx], next: schedule[(idx + 1) % schedule.length], index: idx };
}
function clientKey(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].slice(0, 96); }
function intakeAllowed(req) {
  const key = clientKey(req); const now = Date.now();
  const hits = (intakeHits.get(key) || []).filter(t => now - t < intakeWindowMs);
  if (hits.length >= intakeLimit) return false;
  hits.push(now); intakeHits.set(key, hits); return true;
}
function json(res, status, body) {
  const out = JSON.stringify(body);
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer'});
  res.end(out);
}
function html(res, file) {
  const filePath = path.join(publicDir, file);
  if (!filePath.startsWith(publicDir)) return json(res, 400, { error: 'bad_path' });
  try { const body = fs.readFileSync(filePath); res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-cache'}); res.end(body); }
  catch { json(res, 404, { error: 'not_found' }); }
}
function authorized(req) {
  if (!controlToken) return false;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  const a = Buffer.from(supplied), b = Buffer.from(controlToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function body(req) {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.length > 32768) throw new Error('payload_too_large');
  return raw ? JSON.parse(raw) : {};
}
function clean(v, max=200) { return String(v ?? '').replace(/[<>]/g, '').trim().slice(0,max); }
function audit(action, meta = {}) { state.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action,...meta}); state.audit=state.audit.slice(0,200); saveState(state); }
function addSubmission(b, source='public') {
  const item={id:`YGV-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,at:new Date().toISOString(),name:clean(b.name,120),title:clean(b.title,160),language:clean(b.language || 'und',16),message:clean(b.message,4000),source,status:'SUBMITTED'};
  if (!item.name || !item.title) throw new Error('name_and_title_required');
  state.submissions.unshift(item); state.submissions=state.submissions.slice(0,1000); saveState(state); audit('submission_created',{id:item.id,source}); return item;
}
function addEvent(b) {
  const item={id:`EVT-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,createdAt:new Date().toISOString(),title:clean(b.title,160),date:clean(b.date,32),time:clean(b.time,16),territory:clean(b.territory,64),language:clean(b.language || 'mul',16),status:'PLANNING'};
  if (!item.title || !item.date) throw new Error('event_title_and_date_required');
  state.events.unshift(item); state.events=state.events.slice(0,500); saveState(state); audit('event_created',{id:item.id,title:item.title}); return item;
}
function addSponsorSlot(b) {
  const item={id:`SP-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,createdAt:new Date().toISOString(),name:clean(b.name,160),slot:clean(b.slot,80),status:'PROPOSAL',editorialIndependent:true};
  if (!item.name || !item.slot) throw new Error('sponsor_name_and_slot_required');
  state.sponsorSlots.unshift(item); state.sponsorSlots=state.sponsorSlots.slice(0,500); saveState(state); audit('sponsor_slot_created',{id:item.id,name:item.name}); return item;
}
function dashboard() {
  const {current,next,index}=currentSchedule();
  return {ok:true,station:stationName,tagline:'FAITH. WORSHIP. WORD. — AFRICA TO THE WORLD.',runtime:'izakhono-owned',automation:state.automation,emergency:state.emergency,live:Boolean(liveUrl),liveUrl:liveUrl||null,current,next,index,schedule,playout:playout.snapshot(),counts:{submissions:state.submissions.length,events:state.events.length,sponsorSlots:state.sponsorSlots.length,audit:state.audit.length},recent:{submissions:state.submissions.slice(0,12),events:state.events.slice(0,12),sponsorSlots:state.sponsorSlots.slice(0,12),audit:state.audit.slice(0,30)},serverTime:new Date().toISOString()};
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); const p=url.pathname;
    if (req.method==='GET' && p==='/health') return json(res,200,{ok:true,service:'yhvh-gospel-tv',runtime:'izakhono-owned',station:stationName,playout:playout.snapshot(),time:new Date().toISOString()});
    if (req.method==='GET' && p==='/api/status') return json(res,200,dashboard());
    if (req.method==='GET' && p==='/api/schedule') return json(res,200,{ok:true,schedule});
    if (req.method==='GET' && p==='/api/now') return json(res,200,{ok:true,...currentSchedule()});
    if (req.method==='GET' && p==='/api/live') return json(res,200,{ok:true,configured:Boolean(liveUrl),url:liveUrl||null});
    if (req.method==='GET' && p==='/api/playout') return json(res,200,{ok:true,playout:playout.snapshot(),manifest:playout.manifest});

    if (req.method==='POST' && p==='/api/creator/submit') {
      if (!intakeAllowed(req)) return json(res,429,{ok:false,error:'rate_limit'});
      const item=addSubmission(await body(req),'public_creator');
      return json(res,201,{ok:true,item:{id:item.id,status:item.status}});
    }

    if (p.startsWith('/api/control/')) {
      if (!authorized(req)) return json(res,401,{ok:false,error:'owner_authorization_required'});
      if (req.method==='GET' && p==='/api/control/state') return json(res,200,{ok:true,state:{automation:state.automation,emergency:state.emergency},audit:state.audit.slice(0,30),playout:playout.snapshot(),events:state.events.slice(0,50),sponsorSlots:state.sponsorSlots.slice(0,50),submissions:state.submissions.slice(0,100)});
      if (req.method==='GET' && p==='/api/control/dashboard') return json(res,200,dashboard());
      if (req.method==='POST' && p==='/api/control/automation') { const b=await body(req); state.automation=Boolean(b.enabled); audit('automation_changed',{enabled:state.automation}); return json(res,200,{ok:true,automation:state.automation}); }
      if (req.method==='POST' && p==='/api/control/emergency') { const b=await body(req); state.emergency=Boolean(b.enabled); audit('emergency_slate_changed',{enabled:state.emergency}); return json(res,200,{ok:true,emergency:state.emergency}); }
      if (req.method==='POST' && p==='/api/control/playout/next') { const item=playout.next(); audit('playout_advanced',{itemId:item.id,title:item.title}); return json(res,200,{ok:true,item,playout:playout.snapshot()}); }
      if (req.method==='POST' && p==='/api/control/submission') { const item=addSubmission(await body(req),'owner'); return json(res,201,{ok:true,item}); }
      if (req.method==='POST' && p==='/api/control/event') { const item=addEvent(await body(req)); return json(res,201,{ok:true,item}); }
      if (req.method==='POST' && p==='/api/control/sponsor-slot') { const item=addSponsorSlot(await body(req)); return json(res,201,{ok:true,item}); }
      return json(res,404,{ok:false,error:'control_route_not_found'});
    }
    if (req.method==='GET' && (p==='/' || p==='/index.html')) return html(res,'index.html');
    if (req.method==='GET' && p==='/control') return html(res,'control.html');
    if (req.method==='GET' && p==='/control-center') return html(res,'control-center.html');
    if (req.method==='GET' && p==='/creator') return html(res,'creator.html');
    return json(res,404,{ok:false,error:'not_found'});
  } catch (err) { return json(res,400,{ok:false,error:err?.message||'bad_request'}); }
});
server.listen(port,host,()=>console.log(`${stationName} engine listening on http://${host}:${port}`));
