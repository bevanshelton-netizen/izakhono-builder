import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const pagePath = path.join(repoRoot, 'public', 'commands', 'index.html');
const profilesRoot = path.join(here, 'deploy-profiles');

const host = process.env.IZAKHONO_BIND_HOST || '127.0.0.1';
const port = Number(process.env.IZAKHONO_COMMAND_PORT || 8091);
const controlOrigin = (process.env.IZAKHONO_CONTROL_ORIGIN || 'http://host.docker.internal:9292').replace(/\/$/, '');
const hostOrigin = (process.env.IZAKHONO_OWNER_HOST_ORIGIN || 'http://host.docker.internal').replace(/\/$/, '');
const externalOrigin = (process.env.IZAKHONO_EXTERNAL_COMMAND_ORIGIN || 'https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-commands').replace(/\/$/, '');
const ownerTokenFile = process.env.IZAKHONO_COMMAND_OWNER_TOKEN_FILE || '/run/secrets/izakhono-commands-owner-token';
const controlTokenFile = process.env.IZAKHONO_CONTROL_TOKEN_FILE || '/run/secrets/izakhono-control-owner-token';

const safeHeaders = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

const launchers = {
  'kora': 'https://kora-network.vercel.app',
  'faisready': 'https://faisready-revenue.vercel.app',
  'worknow': 'https://worknow-sa.vercel.app',
  'auto-ai': 'https://auto-ai-eosin.vercel.app',
  'allegro': process.env.IZAKHONO_ALLEGRO_ORIGIN || 'https://allegro.izakhonoafrica.co.za',
  'growth': 'https://izakhono-growth-os.vercel.app',
  'revenue': 'https://izakhono-revenue-os.vercel.app',
};

const workflowSets = {
  'Marketing': ['instagram','facebook','linkedin','tiktok','youtube','reels','social','campaign','ad','ad-variants','content-plan','content-calendar','seo','keywords'],
  'Sales': ['sales','offer','pricing','upsell','cross-sell','follow-up','proposal','quote','pitch','closing','objections','lead-nurture','sales-script','sales-funnel'],
  'Brand': ['brand','positioning','tagline','brand-story','brand-voice','naming','visual-brief','brand-audit','messaging','value-proposition','elevator-pitch','brand-guidelines'],
  'Customer': ['customer','audience','persona','journey','onboarding','retention','loyalty','feedback','survey','support','faq','reviews'],
  'Research': ['competitor','market','market-size','trends','swot','opportunity','benchmark','gap-analysis','pricing-research','supplier-research','customer-research','validation-research'],
  'Content': ['script','email','newsletter','blog','article','press-release','case-study','brochure','flyer','poster-copy','video-brief','podcast','webinar','presentation-copy'],
  'Web & Product': ['website','landing-page','product-page','checkout','app','feature','roadmap','ux-audit','ui-brief','conversion-audit','signup-flow','share-button','analytics-plan','product-launch'],
  'Operations': ['sop','process','workflow','checklist','operations-plan','quality-control','procurement','inventory','fulfilment','service-delivery','incident','handover'],
  'Finance': ['budget','cashflow','forecast','break-even','margin','unit-economics','revenue-model','funding','investor-model','cost-cutting','invoice-plan','financial-dashboard'],
  'Legal & Risk': ['terms','privacy','refund-policy','delivery-policy','risk-register','compliance-check','claims-check','contract-brief','due-diligence','data-map','security-review','disaster-recovery'],
  'People': ['job-ad','role-profile','interview','onboarding-staff','training-plan','performance-plan','team-structure','org-chart','shift-plan','meeting-agenda','meeting-summary','delegation'],
  'Education': ['course','lesson','curriculum','assessment','quiz','study-plan','facilitator-guide','learner-guide','rubric','certificate-plan','campus-plan','bursary-plan'],
  'Media': ['tv-show','radio-show','episode','broadcast-grid','sponsorship','media-kit','artist-onboarding','rights-check','royalty-plan','event-broadcast','channel-launch','content-acquisition'],
  'Infrastructure': ['dns','tls','deployment','hosting','ci','release','rollback','backup','monitoring','domain-cutover','incident-response','production-check'],
  'Commerce': ['catalogue','product-bundle','store','merchant-check','payment-flow','abandoned-cart','promotion','coupon','subscription','booking-flow','order-flow','returns'],
  'Owner Strategy': ['priority','revenue-priority','90-day-plan','weekly-plan','daily-plan','decision-brief','board-pack','investor-pack','partnership','acquisition-readiness','portfolio-review','owner-dashboard'],
};

const stepLibrary = {
  'Marketing': ['Define the objective and target audience.','Build the channel-specific message and creative brief.','Set CTA, tracking and publishing cadence.','Review performance signals and iterate.'],
  'Sales': ['Define the buyer, offer and commercial objective.','Build the sales message, proof and objection handling.','Set pricing, CTA and follow-up sequence.','Track conversion and next action.'],
  'Brand': ['Define audience, promise and differentiator.','Build the messaging system and tone.','Translate it into visual/content guidance.','Check consistency across customer touchpoints.'],
  'Customer': ['Define the customer segment and desired outcome.','Map the customer journey and friction points.','Design the intervention and measurement.','Capture feedback and improve the next cycle.'],
  'Research': ['Define the research question and decision it supports.','Collect comparable evidence and constraints.','Separate facts, assumptions and gaps.','Produce implications and next actions.'],
  'Content': ['Define audience, objective and format.','Build the structure and key messages.','Create the first production-ready draft.','Add CTA, proof and distribution notes.'],
  'Web & Product': ['Define user goal and conversion goal.','Map the screen/feature flow and required data.','Specify build, analytics, payments and legal boundaries.','Set validation and launch gates.'],
  'Operations': ['Define trigger, owner and desired outcome.','Map the repeatable steps and control points.','Assign evidence, exceptions and escalation.','Measure completion, quality and turnaround time.'],
  'Finance': ['Define the financial decision and time horizon.','Collect assumptions, revenue and cost drivers.','Model the scenario and sensitivities.','Identify cash impact, risks and decision gates.'],
  'Legal & Risk': ['Define the activity, jurisdiction and exposure.','Identify required disclosures, controls and evidence.','Flag items requiring qualified professional review.','Record approval, version and implementation owner.'],
  'People': ['Define the role or people outcome.','Set responsibilities, criteria and process.','Create the communication/training material.','Track ownership, completion and feedback.'],
  'Education': ['Define learner profile and learning outcome.','Structure content, activity and assessment.','Set delivery resources and facilitator guidance.','Measure learner evidence and completion.'],
  'Media': ['Define audience, format, rights and commercial goal.','Design content, schedule and production workflow.','Set sponsorship, distribution and rights controls.','Track audience, revenue and content performance.'],
  'Infrastructure': ['Define the target environment and current state.','Inspect dependencies, credentials and failure points.','Execute the smallest reversible change.','Verify health, evidence and rollback readiness.'],
  'Commerce': ['Define product, buyer and transaction goal.','Build catalogue, pricing and checkout flow.','Set fulfilment, refund and customer communication.','Track checkout, payment and fulfilment evidence.'],
  'Owner Strategy': ['Define the owner decision and desired outcome.','Rank constraints, dependencies and evidence.','Choose the smallest high-leverage next actions.','Set accountable owners, checkpoints and proof of completion.'],
};

const actions = [
  {name:'health',label:'Command Health',category:'Owner Control',description:'Check the owned Command Centre and control-plane readiness.',kind:'action'},
  {name:'infra',label:'Infrastructure Health',category:'Owner Control',description:'Probe the IZAKHONO owned infrastructure services from NODE01.',kind:'action'},
  {name:'node',label:'NODE Identity',category:'Owner Control',description:'Read signed IZAKHONO NODE identity and deployment capabilities through CONTROL.',kind:'action'},
  {name:'deploy-status',label:'Deployment Status',category:'Build & Deploy',description:'Show recent NODE deployment jobs through IZAKHONO CONTROL.',kind:'action'},
  {name:'job',label:'Deployment Job',category:'Build & Deploy',description:'Inspect one deployment job by ID.',kind:'action',requiresArg:true},
  {name:'deploy',label:'Owned Production Deploy',category:'Build & Deploy',description:'Submit an approved immutable production deployment to IZAKHONO CONTROL → NODE.',kind:'action',requiresArg:true},
  {name:'commands',label:'Command Catalogue',category:'Owner Control',description:'List the local owned Command Centre catalogue.',kind:'action',aliases:['help']},
];

const commands = [
  ...actions,
  ...Object.entries(launchers).map(([name,path])=>({name,label:'Open '+name,category:'Platforms',description:'Open approved platform route.',kind:'launcher',path})),
  ...Object.entries(workflowSets).flatMap(([category,names])=>names.map(name=>({
    name,label:name.split('-').map(x=>x[0]?.toUpperCase()+x.slice(1)).join(' '),category,
    description:name.split('-').join(' ')+' structured workflow.',kind:'workflow',steps:stepLibrary[category]||[]
  }))),
];

const infrastructure = [
  ['DATA',8787,'/health'],
  ['RUNTIME',8790,'/health'],
  ['EDGE',8795,'/health'],
  ['OBJECT',8800,'/health'],
  ['QUEUE',8810,'/health'],
  ['AUTH',8820,'/health'],
  ['ANALYTICS',8830,'/health'],
  ['NOTIFY',8840,'/health'],
  ['AI_GATEWAY',8850,'/health'],
  ['CODE',8860,'/health'],
  ['BACKUP',8870,'/health'],
  ['CI_WORKER',8880,'/health'],
  ['REPLICA',8890,'/health'],
  ['DNS',8900,'/health'],
  ['PACKAGE',8910,'/health'],
  ['FAILOVER',8920,'/health'],
  ['WITNESS',8930,'/health'],
  ['NODE',9191,'/readyz'],
  ['CONTROL',9292,'/healthz'],
  ['FORTRESS',18109,'/health'],
];

function send(res,status,body,headers={}) {
  res.writeHead(status,{...safeHeaders,...headers});
  res.end(body);
}
function json(res,status,data,headers={}) {
  send(res,status,JSON.stringify(data),{'content-type':'application/json; charset=utf-8',...headers});
}
async function readBody(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>256*1024) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function fetchWithTimeout(url,init={},timeoutMs=4500) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try { return await fetch(url,{...init,signal:controller.signal,cache:'no-store'}); }
  finally { clearTimeout(timer); }
}
async function secretText(file) {
  try { return (await fs.readFile(file,'utf8')).trim(); } catch { return ''; }
}
function secureEqual(a,b) {
  const aa=Buffer.from(String(a||'')); const bb=Buffer.from(String(b||''));
  return aa.length===bb.length && aa.length>0 && timingSafeEqual(aa,bb);
}
async function authorized(req) {
  const expected=await secretText(ownerTokenFile);
  return secureEqual(req.headers['x-admin-secret'],expected);
}
async function controlRequest(method,pathname,body) {
  const token=await secretText(controlTokenFile);
  if (!token) throw new Error('IZAKHONO CONTROL owner token is unavailable.');
  const headers=new Headers({authorization:'Bearer '+token,accept:'application/json'});
  if (body!==undefined) headers.set('content-type','application/json');
  const r=await fetchWithTimeout(controlOrigin+pathname,{method,headers,body:body===undefined?undefined:JSON.stringify(body)},20000);
  const text=await r.text();
  let data={}; try { data=text?JSON.parse(text):{}; } catch { data={raw:text}; }
  if (!r.ok) {
    const error=new Error(data.error||('CONTROL request failed ('+r.status+')'));
    error.status=r.status; error.data=data; throw error;
  }
  return data;
}
async function probe(name,p,pathName) {
  try {
    const r=await fetchWithTimeout(hostOrigin+':'+p+pathName,{method:'GET',headers:{accept:'application/json'}},1800);
    return {name,port:p,ok:r.ok,status:r.status};
  } catch (error) {
    return {name,port:p,ok:false,status:0,error:error?.name||'unreachable'};
  }
}
async function infraHealth() {
  const results=await Promise.all(infrastructure.map(x=>probe(x[0],x[1],x[2])));
  return {healthy:results.filter(x=>x.ok).length,total:results.length,services:results};
}
function commandStats() {
  return {
    total:commands.length,
    actions:commands.filter(c=>c.kind==='action').length,
    launchers:commands.filter(c=>c.kind==='launcher').length,
    workflows:commands.filter(c=>c.kind==='workflow').length,
    categories:new Set(commands.map(c=>c.category)).size,
  };
}
function parseCommand(input) {
  const clean=String(input||'').trim().replace(/^\/+/, '');
  const match=clean.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  return {name:(match?.[1]||'').toLowerCase(),args:(match?.[2]||'').trim()};
}
async function loadProfile(name) {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(name)) throw new Error('Invalid deployment profile.');
  const file=path.join(profilesRoot,name+'.json');
  const profile=JSON.parse(await fs.readFile(file,'utf8'));
  return profile;
}
async function externalHealth() {
  try {
    const r=await fetchWithTimeout(externalOrigin+'?api=health',{headers:{accept:'application/json'}},3000);
    return {ok:r.ok,status:r.status};
  } catch { return {ok:false,status:0}; }
}
async function runCommand(req,res) {
  if (!(await authorized(req))) return json(res,401,{ok:false,error:'Unauthorized'});
  let payload={};
  try { payload=JSON.parse(await readBody(req)||'{}'); } catch { return json(res,400,{ok:false,error:'Expected application/json'}); }
  const raw=String(payload.input||'').trim();
  const {name,args}=parseCommand(raw);
  const definition=commands.find(c=>c.name===name || c.aliases?.includes(name));
  if (!definition) return json(res,404,{ok:false,error:'Unknown command /'+name+'.'});
  if (definition.requiresArg && !args) return json(res,400,{ok:false,error:'/'+definition.name+' requires an argument.'});

  if (definition.kind==='launcher') return json(res,200,{ok:true,command:definition.name,kind:'launcher',navigate:definition.path,message:definition.label+' launcher ready.'});
  if (definition.kind==='workflow') return json(res,200,{ok:true,command:definition.name,kind:'workflow',args,workflow:definition,message:'Structured workflow opened on the owned Command Centre.'});
  if (definition.name==='commands') return json(res,200,{ok:true,command:'commands',kind:'action',message:commands.length+' commands are available.',data:{stats:commandStats()}});
  if (definition.name==='infra') {
    const data=await infraHealth();
    return json(res,data.healthy>0?200:503,{ok:data.healthy>0,command:'infra',kind:'action',message:data.healthy+'/'+data.total+' owned infrastructure services responded.',data});
  }
  if (definition.name==='health') {
    const [infra,external]=await Promise.all([infraHealth(),externalHealth()]);
    let control=false; try { const r=await fetchWithTimeout(controlOrigin+'/healthz',{},1800); control=r.ok; } catch {}
    return json(res,200,{ok:true,command:'health',kind:'action',message:'IZAKHONO Command Centre health loaded.',data:{gateway:'ready',control,owned_services_healthy:infra.healthy,owned_services_total:infra.total,external_resilience:external}});
  }
  if (definition.name==='node') {
    try { const data=await controlRequest('GET','/v1/node'); return json(res,200,{ok:true,command:'node',kind:'action',message:'IZAKHONO NODE identity loaded through CONTROL.',data}); }
    catch (e) { return json(res,e.status||503,{ok:false,error:e.message,data:e.data||null}); }
  }
  if (definition.name==='deploy-status') {
    try { const data=await controlRequest('GET','/v1/status'); return json(res,200,{ok:true,command:'deploy-status',kind:'action',message:'Recent IZAKHONO NODE deployment jobs loaded.',data}); }
    catch (e) { return json(res,e.status||503,{ok:false,error:e.message,data:e.data||null}); }
  }
  if (definition.name==='job') {
    const id=args.split(/\s+/)[0];
    if (!/^[A-Za-z0-9._:-]{3,160}$/.test(id)) return json(res,400,{ok:false,error:'Invalid job ID.'});
    try { const data=await controlRequest('GET','/v1/jobs/'+encodeURIComponent(id)); return json(res,200,{ok:true,command:'job',kind:'action',message:'Deployment job loaded.',data}); }
    catch (e) { return json(res,e.status||503,{ok:false,error:e.message,data:e.data||null}); }
  }
  if (definition.name==='deploy') {
    const parts=args.split(/\s+/).filter(Boolean);
    const profileName=parts[0]||'';
    const ref=parts[1]||'';
    if (!/^[0-9a-f]{40}$/.test(ref)) {
      return json(res,400,{ok:false,error:'Production deployment requires: /deploy <approved-profile> <40-character commit SHA>.'});
    }
    try {
      const profile=await loadProfile(profileName);
      const job={...profile,ref};
      const data=await controlRequest('POST','/v1/deploy',job);
      return json(res,202,{ok:true,command:'deploy',kind:'action',message:'Deployment accepted by IZAKHONO CONTROL and handed to NODE. Public-live status still requires health/EDGE verification.',data});
    } catch (e) {
      const code=e?.code==='ENOENT'?404:(e.status||503);
      return json(res,code,{ok:false,error:e?.code==='ENOENT'?'Approved deployment profile not found.':e.message,data:e.data||null});
    }
  }
  return json(res,501,{ok:false,error:'Action has no owned executor.'});
}

const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url||'/','http://node01.local');
    const pathname=url.pathname;

    if (req.method==='GET' && (pathname==='/' || pathname==='/commands' || pathname==='/commands/')) {
      const page=await fs.readFile(pagePath,'utf8');
      return send(res,200,page,{'content-type':'text/html; charset=utf-8'});
    }
    if (req.method==='GET' && (pathname==='/healthz' || pathname==='/api/health')) {
      const [infra,external]=await Promise.all([infraHealth(),externalHealth()]);
      return json(res,200,{
        ok:true,
        node:'IZAKHONO NODE01 command gateway',
        uptime_seconds:Math.floor(process.uptime()),
        authority:'IZAKHONO CONTROL -> NODE',
        owned_services_healthy:infra.healthy,
        owned_services_total:infra.total,
        external_resilience:external,
      });
    }
    if (req.method==='GET' && pathname==='/api/commands') {
      if (!(await authorized(req))) return json(res,401,{ok:false,error:'Unauthorized'});
      return json(res,200,{
        ok:true,
        stats:commandStats(),
        commands,
        execution_boundary:'Owner actions execute through local IZAKHONO CONTROL/NODE. External infrastructure is resilience-only.',
      },{'x-izakhono-route':'internal-control'});
    }
    if (req.method==='POST' && pathname==='/api/commands/run') return runCommand(req,res);
    return json(res,404,{ok:false,error:'Not found'});
  } catch (error) {
    return json(res,500,{ok:false,error:'NODE01 Command Centre error',detail:String(error?.message||error).slice(0,300)});
  }
});

server.listen(port,host,()=>{
  console.log('[IZAKHONO COMMANDS] listening on http://'+host+':'+port);
  console.log('[IZAKHONO COMMANDS] authority: '+controlOrigin+' -> NODE');
  console.log('[IZAKHONO COMMANDS] external resilience: configured');
});
