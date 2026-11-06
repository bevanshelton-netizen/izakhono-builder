import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPlayoutEngine } from './playout/playout-engine.mjs';
import { createBroadcastRuntime } from './playout/broadcast-runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const dataDir = process.env.YHVH_DATA_DIR || path.join(__dirname, 'data');
const hlsDir = process.env.YHVH_HLS_DIR || path.join(dataDir, 'hls');
const stateFile = path.join(dataDir, 'state.json');
const broadcastManifestFile = process.env.YHVH_BROADCAST_MANIFEST || path.join(dataDir, 'broadcast-inputs.json');
const broadcastManifestTemplate = path.join(__dirname, 'playout', 'broadcast-inputs.json');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const controlToken = process.env.YHVH_CONTROL_TOKEN || '';
const liveUrl = process.env.YHVH_LIVE_URL || '';
const vaultDir = process.env.YHVH_CONTENT_VAULT || path.join(__dirname, 'content-vault');
const stationName = 'YHVH GOSPEL TV';
const intakeWindowMs = 60 * 60 * 1000;
const intakeLimit = 12;
const intakeHits = new Map();

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(hlsDir, { recursive: true });
fs.mkdirSync(vaultDir, { recursive: true });
if (!fs.existsSync(broadcastManifestFile)) fs.copyFileSync(broadcastManifestTemplate, broadcastManifestFile);

const seed = {
  automation: true,
  emergency: false,
  startedAt: new Date().toISOString(),
  currentIndex: 0,
  submissions: [],
  events: [],
  sponsorSlots: [],
  commercialEnquiries: [],
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
  vaultDir
});
const broadcast = createBroadcastRuntime({
  vaultDir,
  hlsDir,
  rightsManifestPath: broadcastManifestFile,
  territory: process.env.YHVH_BROADCAST_TERRITORY || 'ZA',
  outputUrl: process.env.YHVH_RTMP_URL || ''
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

function minutesNow() {
  // EPG times are station-local, not host-local. Keep the schedule correct
  // when the service runs in a UTC container or a non-South-African region.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute) + Number(values.second) / 60;
}
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
function hlsFile(res, pathname) {
  const rel = decodeURIComponent(pathname.slice('/hls/'.length));
  const filePath = path.resolve(hlsDir, rel);
  const root = path.resolve(hlsDir) + path.sep;
  if (!filePath.startsWith(root)) return json(res, 400, { error: 'bad_path' });
  if (!fs.existsSync(filePath)) return json(res, 404, { error: 'hls_not_found' });
  const realRoot = fs.realpathSync(hlsDir) + path.sep;
  const realFile = fs.realpathSync(filePath);
  if (!realFile.startsWith(realRoot) || !fs.statSync(realFile).isFile()) return json(res, 404, { error: 'hls_not_found' });
  const ext = path.extname(realFile).toLowerCase();
  const type = ext === '.m3u8' ? 'application/vnd.apple.mpegurl' : ext === '.ts' ? 'video/mp2t' : 'application/octet-stream';
  res.writeHead(200, {'content-type':type,'cache-control':'no-cache','access-control-allow-origin':'*','x-content-type-options':'nosniff'});
  fs.createReadStream(realFile).pipe(res);
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
const commercialPackages = [
  {id:'COMMUNITY_SUPPORTER',name:'Community Supporter',description:'Support a community Gospel segment, local ministry feature or faith-based initiative.',inventory:'Community feature / segment association',price:'QUOTE_ON_REQUEST'},
  {id:'PROGRAMME_PARTNER',name:'Programme Partner',description:'Partner with a recurring programme, subject to editorial independence and scheduling approval.',inventory:'Programme sponsorship association',price:'QUOTE_ON_REQUEST'},
  {id:'PRIME_TIME_PARTNER',name:'Prime-Time Partner',description:'Request a premium association around selected evening programming and special broadcasts.',inventory:'Selected evening programme inventory',price:'QUOTE_ON_REQUEST'},
  {id:'NATIONAL_CAMPAIGN',name:'National Campaign Partner',description:'Discuss a multi-programme or event-led campaign across approved station inventory.',inventory:'Multi-programme / event campaign',price:'QUOTE_ON_REQUEST'}
];
function addCommercialEnquiry(b, req) {
  const item={id:'ADV-'+Date.now()+'-'+crypto.randomBytes(2).toString('hex'),createdAt:new Date().toISOString(),organisation:clean(b.organisation,160),contactName:clean(b.contactName,120),email:clean(b.email,180).toLowerCase(),phone:clean(b.phone,40),packageId:clean(b.packageId,48),campaign:clean(b.campaign,1000),budget:clean(b.budget,80),territory:clean(b.territory,80),status:'NEW'};
  if(!item.organisation||!item.contactName||!item.email||!item.campaign)throw new Error('organisation_contact_email_and_campaign_required');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email))throw new Error('valid_email_required');
  if(!commercialPackages.some(x=>x.id===item.packageId))throw new Error('invalid_commercial_package');
  state.commercialEnquiries=state.commercialEnquiries||[];state.commercialEnquiries.unshift(item);state.commercialEnquiries=state.commercialEnquiries.slice(0,1000);saveState(state);audit('commercial_enquiry_received',{id:item.id,packageId:item.packageId});return item;
}
function addSponsorSlot(b) {
  const item={id:`SP-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,createdAt:new Date().toISOString(),name:clean(b.name,160),slot:clean(b.slot,80),status:'PROPOSAL',editorialIndependent:true};
  if (!item.name || !item.slot) throw new Error('sponsor_name_and_slot_required');
  state.sponsorSlots.unshift(item); state.sponsorSlots=state.sponsorSlots.slice(0,500); saveState(state); audit('sponsor_slot_created',{id:item.id,name:item.name}); return item;
}
function loadBroadcastManifest() {
  const m=JSON.parse(fs.readFileSync(broadcastManifestFile,'utf8'));
  if (!Array.isArray(m.items)) m.items=[];
  return m;
}
function saveBroadcastManifest(m) {
  const tmp=broadcastManifestFile+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(m,null,2));
  fs.renameSync(tmp,broadcastManifestFile);
}
function safeVaultPath(v) {
  const rel=clean(v,500).replaceAll('\\','/');
  if (!rel || rel.startsWith('/') || rel.split('/').includes('..')) throw new Error('invalid_vault_path');
  return rel;
}
function registerContent(b) {
  const m=loadBroadcastManifest();
  const item={
    id:clean(b.id,80)||`YGV-MEDIA-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    title:clean(b.title,180),
    path:safeVaultPath(b.path),
    language:clean(b.language||'und',16),
    category:clean(b.category||'general',64),
    source:clean(b.source||'owner',120),
    rightsEvidence:clean(b.rightsEvidence||'',1000),
    rightsStatus:'REVIEW_REQUIRED',
    qcStatus:'PENDING',
    territories:[],
    status:'REVIEW_REQUIRED',
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  if (!item.title) throw new Error('content_title_required');
  if (m.items.some((x)=>x.id===item.id || x.path===item.path)) throw new Error('content_already_registered');
  m.items.unshift(item); saveBroadcastManifest(m); audit('content_registered',{id:item.id,title:item.title,path:item.path}); return item;
}
function decideContent(b) {
  const m=loadBroadcastManifest(); const id=clean(b.id,80); const item=m.items.find((x)=>x.id===id);
  if (!item) throw new Error('content_not_found');
  if (b.rightsStatus!==undefined) {
    const v=clean(b.rightsStatus,32);
    if (!['REVIEW_REQUIRED','CLEAR','RESTRICTED','BLOCKED'].includes(v)) throw new Error('invalid_rights_status');
    if (v==='CLEAR' && !clean(b.rightsEvidence??item.rightsEvidence,1000)) throw new Error('rights_evidence_required');
    item.rightsStatus=v;
  }
  if (b.rightsEvidence!==undefined) item.rightsEvidence=clean(b.rightsEvidence,1000);
  if (b.qcStatus!==undefined) {
    const v=clean(b.qcStatus,32);
    if (!['PENDING','PASS','FAIL'].includes(v)) throw new Error('invalid_qc_status');
    item.qcStatus=v;
  }
  if (b.territories!==undefined) {
    if (!Array.isArray(b.territories)) throw new Error('territories_must_be_array');
    item.territories=[...new Set(b.territories.map((x)=>clean(x,8).toUpperCase()).filter(Boolean))].slice(0,64);
  }
  const mediaPath=path.resolve(vaultDir,item.path);
  const vaultRoot=path.resolve(vaultDir)+path.sep;
  const realVaultRoot=fs.realpathSync(vaultDir)+path.sep;
  let physicallyPresent=false;
  if (mediaPath.startsWith(vaultRoot) && fs.existsSync(mediaPath)) {
    const realMediaPath=fs.realpathSync(mediaPath);
    physicallyPresent=realMediaPath.startsWith(realVaultRoot) && fs.statSync(realMediaPath).isFile();
  }
  const eligible=item.rightsStatus==='CLEAR' && item.qcStatus==='PASS' && item.territories.includes(broadcast.territory) && physicallyPresent;
  item.status=eligible?'READY':'REVIEW_REQUIRED';
  item.updatedAt=new Date().toISOString();
  saveBroadcastManifest(m);
  audit('content_decision',{id:item.id,rightsStatus:item.rightsStatus,qcStatus:item.qcStatus,territories:item.territories,status:item.status,physicallyPresent});
  return {...item,physicallyPresent,eligible};
}
function contentQueue() {
  const m=loadBroadcastManifest();
  let inspected=[]; try { inspected=broadcast.inspectInputs(); } catch {}
  const byId=new Map(inspected.map((x)=>[x.id,x]));
  return m.items.map((x)=>byId.get(x.id)||{...x,eligible:false,blockedReasons:['inspection_unavailable']});
}
function decideCommercialEnquiry(b) {
  const id=clean(b.id,100);const item=(state.commercialEnquiries||[]).find(x=>x.id===id);if(!item)throw new Error('commercial_enquiry_not_found');
  const allowed=['NEW','REVIEWING','CONTACTED','PROPOSAL_SENT','WON','LOST'];
  const status=clean(b.status,24).toUpperCase();if(!allowed.includes(status))throw new Error('invalid_enquiry_status');
  item.status=status;item.updatedAt=new Date().toISOString();if(b.ownerNote!==undefined)item.ownerNote=clean(b.ownerNote,500);
  saveState(state);audit('commercial_enquiry_updated',{id:item.id,status:item.status});return item;
}
function decideSponsorSlot(b) {
  const id=clean(b.id,100);
  const item=state.sponsorSlots.find((x)=>x.id===id);
  if (!item) throw new Error('sponsor_slot_not_found');
  const allowed=['PROPOSAL','UNDER_REVIEW','APPROVED','SCHEDULED','DELIVERED','INVOICED','PAID','DECLINED'];
  if (b.status!==undefined) {
    const status=clean(b.status,24).toUpperCase();
    if (!allowed.includes(status)) throw new Error('invalid_sponsor_status');
    if (status==='PAID' && !clean(b.paymentReference??item.paymentReference,120)) throw new Error('payment_reference_required');
    item.status=status;
  }
  if (b.valueZar!==undefined) {
    const value=Number(b.valueZar);
    if (!Number.isFinite(value) || value<0 || value>1000000000) throw new Error('invalid_sponsor_value');
    item.valueZar=Math.round(value*100)/100;
  }
  if (b.paymentReference!==undefined) item.paymentReference=clean(b.paymentReference,120);
  if (b.campaignReference!==undefined) item.campaignReference=clean(b.campaignReference,120);
  item.updatedAt=new Date().toISOString();
  saveState(state);
  audit('sponsor_slot_updated',{id:item.id,status:item.status,valueZar:item.valueZar??null});
  return item;
}
function dashboard() {
  const {current,next,index}=currentSchedule();
  return {ok:true,station:stationName,tagline:'FAITH. WORSHIP. WORD. — AFRICA TO THE WORLD.',runtime:'izakhono-owned',automation:state.automation,emergency:state.emergency,live:Boolean(liveUrl),liveUrl:liveUrl||null,current,next,index,schedule,playout:playout.snapshot(),broadcast:broadcast.snapshot(),counts:{submissions:state.submissions.length,events:state.events.length,sponsorSlots:state.sponsorSlots.length,commercialEnquiries:(state.commercialEnquiries||[]).length,audit:state.audit.length},recent:{submissions:state.submissions.slice(0,12),events:state.events.slice(0,12),sponsorSlots:state.sponsorSlots.slice(0,12),commercialEnquiries:(state.commercialEnquiries||[]).slice(0,30),audit:state.audit.slice(0,30)},serverTime:new Date().toISOString()};
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); const p=url.pathname;
    if (req.method==='GET' && p==='/health') return json(res,200,{ok:true,service:'yhvh-gospel-tv',runtime:'izakhono-owned',station:stationName,playout:playout.snapshot(),broadcast:broadcast.snapshot(),time:new Date().toISOString()});
    if (req.method==='GET' && p==='/api/status') return json(res,200,dashboard());
    if (req.method==='GET' && p==='/api/commercial/packages') return json(res,200,{ok:true,packages:commercialPackages});
    if (req.method==='POST' && p==='/api/commercial/enquiry') { if(!intakeAllowed(req))return json(res,429,{ok:false,error:'rate_limit'});const item=addCommercialEnquiry(await body(req),req);return json(res,201,{ok:true,item:{id:item.id,status:item.status}}); }
    if (req.method==='GET' && p==='/api/schedule') return json(res,200,{ok:true,schedule});
    if (req.method==='GET' && p==='/api/now') return json(res,200,{ok:true,...currentSchedule()});
    if (req.method==='GET' && p==='/api/live') return json(res,200,{ok:true,configured:Boolean(liveUrl),url:liveUrl||null});
    if (req.method==='GET' && p==='/api/playout') return json(res,200,{ok:true,playout:playout.snapshot(),manifest:playout.manifest});
    if (req.method==='GET' && p==='/api/broadcast') return json(res,200,{ok:true,broadcast:broadcast.snapshot()});
    if (req.method==='GET' && p.startsWith('/hls/')) return hlsFile(res,p);

    if (req.method==='POST' && p==='/api/creator/submit') {
      if (!intakeAllowed(req)) return json(res,429,{ok:false,error:'rate_limit'});
      const item=addSubmission(await body(req),'public_creator');
      return json(res,201,{ok:true,item:{id:item.id,status:item.status}});
    }

    if (p.startsWith('/api/control/')) {
      if (!authorized(req)) return json(res,401,{ok:false,error:'owner_authorization_required'});
      if (req.method==='GET' && p==='/api/control/state') return json(res,200,{ok:true,state:{automation:state.automation,emergency:state.emergency},audit:state.audit.slice(0,30),playout:playout.snapshot(),broadcast:broadcast.snapshot(),events:state.events.slice(0,50),sponsorSlots:state.sponsorSlots.slice(0,50),submissions:state.submissions.slice(0,100)});
      if (req.method==='GET' && p==='/api/control/dashboard') return json(res,200,dashboard());
      if (req.method==='GET' && p==='/api/control/broadcast') return json(res,200,{ok:true,broadcast:broadcast.snapshot()});
      if (req.method==='GET' && p==='/api/control/content') return json(res,200,{ok:true,territory:broadcast.territory,items:contentQueue()});
      if (req.method==='POST' && p==='/api/control/automation') { const b=await body(req); state.automation=Boolean(b.enabled); audit('automation_changed',{enabled:state.automation}); return json(res,200,{ok:true,automation:state.automation}); }
      if (req.method==='POST' && p==='/api/control/emergency') { const b=await body(req); state.emergency=Boolean(b.enabled); audit('emergency_slate_changed',{enabled:state.emergency}); return json(res,200,{ok:true,emergency:state.emergency}); }
      if (req.method==='POST' && p==='/api/control/playout/next') { const item=playout.next(); audit('playout_advanced',{itemId:item.id,title:item.title}); return json(res,200,{ok:true,item,playout:playout.snapshot()}); }
      if (req.method==='POST' && p==='/api/control/broadcast/start') { const result=broadcast.start(); audit(result.started ? 'broadcast_started' : 'broadcast_start_requested',{pid:result.pid||null,inputCount:result.inputCount||0}); return json(res,result.ok ? 200 : 409,result); }
      if (req.method==='POST' && p==='/api/control/broadcast/stop') { const result=broadcast.stop(); audit('broadcast_stop_requested',{stopped:result.stopped}); return json(res,200,result); }
      if (req.method==='POST' && p==='/api/control/content/register') { const item=registerContent(await body(req)); return json(res,201,{ok:true,item}); }
      if (req.method==='POST' && p==='/api/control/content/decision') { const item=decideContent(await body(req)); return json(res,200,{ok:true,item,broadcast:broadcast.snapshot()}); }
      if (req.method==='POST' && p==='/api/control/submission') { const item=addSubmission(await body(req),'owner'); return json(res,201,{ok:true,item}); }
      if (req.method==='POST' && p==='/api/control/event') { const item=addEvent(await body(req)); return json(res,201,{ok:true,item}); }
      if (req.method==='POST' && p==='/api/control/sponsor-slot') { const item=addSponsorSlot(await body(req)); return json(res,201,{ok:true,item}); }
      if (req.method==='POST' && p==='/api/control/sponsor-slot/decision') { const item=decideSponsorSlot(await body(req)); return json(res,200,{ok:true,item}); }
      if (req.method==='POST' && p==='/api/control/commercial-enquiry/decision') { const item=decideCommercialEnquiry(await body(req)); return json(res,200,{ok:true,item}); }
      return json(res,404,{ok:false,error:'control_route_not_found'});
    }
    if (req.method==='GET' && (p==='/' || p==='/index.html')) return html(res,'index.html');
    if (req.method==='GET' && p==='/control') return html(res,'control.html');
    if (req.method==='GET' && p==='/control-center') return html(res,'control-center.html');
    if (req.method==='GET' && p==='/broadcast') return html(res,'broadcast.html');
    if (req.method==='GET' && p==='/creator') return html(res,'creator.html');
    if (req.method==='GET' && p==='/advertise') return html(res,'advertise.html');
    return json(res,404,{ok:false,error:'not_found'});
  } catch (err) { return json(res,400,{ok:false,error:err?.message||'bad_request'}); }
});
server.listen(port,host,()=>console.log(`${stationName} engine listening on http://${host}:${port}`));
