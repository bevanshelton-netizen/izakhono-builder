import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serviceContracts, resolveService, supports } from './services/contracts.mjs';
import { prepareAction } from './services/action.mjs';
import { prepareServiceDispatch } from './services/dispatcher.mjs';
import { supportedNotificationChannels } from './services/notifications.mjs';
import { publicRuntimeView } from './services/runtime.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT || 8781);
const registry = JSON.parse(await readFile(join(root, 'registry.json'), 'utf8'));
const parallel = [
  {slug:'search',name:'IZAKHONO SEARCH',category:'Discovery',icon:'⌕',description:'African-first web, local, business, product and content discovery with AI answers and private search.',status:'foundation',publicUrl:'/search'},
  {slug:'connecta',name:'CONNECTA',category:'Community',icon:'◉',description:'Social network, communities, messaging, creators, business pages, jobs and marketplace connections.',status:'foundation',publicUrl:'/connecta'},
  {slug:'ai',name:'ONE AI',category:'Intelligence',icon:'✦',description:'Personal, business, school and developer intelligence with creation, analysis and automation.',status:'foundation',publicUrl:'/ai'},
  {slug:'cloud',name:'ONE CLOUD',category:'Workspace',icon:'☁',description:'Files, documents, sheets, presentations, mail, calendar and team collaboration.',status:'foundation',publicUrl:'/cloud'},
  {slug:'commerce',name:'ONE COMMERCE',category:'Commerce',icon:'◇',description:'Marketplace, storefronts, payments, invoicing, digital products and controlled advertising.',status:'foundation',publicUrl:'/commerce'},
  {slug:'nav',name:'IZAKHONO NAV',category:'Mobility & Safety',icon:'⌖',description:'Navigation, driver safety, emergency response, fleet intelligence and African road intelligence.',status:'foundation',publicUrl:'/nav'},
  {slug:'fortress',name:'FORTRESS',category:'Security',icon:'◆',description:'Identity protection, fraud signals, device intelligence, permissions and security audit.',status:'foundation',publicUrl:'/fortress'}
];
const contracts = Object.fromEntries(Object.entries(serviceContracts).map(([slug,c])=>[slug,{...c,dependencies:slug==='fortress'?['one']:['one','fortress'],api_version:'v1',policy_class:'foundation',enabled:true}]));
const services = [...parallel, ...registry.services.filter(service => !parallel.some(p => p.name === service.name))];
const bySlug = new Map(services.map(service => [service.slug, service]));
const runtime = new Map(parallel.map(service => [service.slug, {service_slug:service.slug,state:'foundation',health:'unknown',version:'v1',last_check_at:null}]));
const builderInternalUrl = String(process.env.IZAKHONO_BUILDER_INTERNAL_URL || '').trim().replace(/\/+$/, '');
const flowInternalUrl = String(process.env.IZAKHONO_FLOW_INTERNAL_URL || '').trim().replace(/\/+$/, '');

const json = (res, status, body) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}); res.end(JSON.stringify(body)); };
const mime = path => ({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'}[extname(path)] || 'application/octet-stream');
function search(query) { const q=String(query||'').trim().toLowerCase(); if(!q)return services; return services.filter(service=>[service.name,service.slug,service.category,service.description].join(' ').toLowerCase().includes(q)); }
function builderDescriptor() { return {integrated:true,superApp:'IZAKHONO ONE',service:'IZAKHONO BUILDER',bridge:'owned-service-bridge',engineIndependent:true,sourceOfTruth:'izakhono-builder',internalHealthConfigured:Boolean(builderInternalUrl),publicRoute:'gated-until-independently-verified',promises:['describe-once','responsive-web-pwa','desktop-mobile-ready','owned-source','validation','controlled-publish'],privacy:{tracking:false,profiling:false,advertisingIdentifiers:false}}; }
function flowDescriptor() { return {integrated:true,superApp:'IZAKHONO ONE',service:'IZAKHONO FLOW',bridge:'owned-service-bridge',engineIndependent:true,sourceOfTruth:'products/izakhono-flow',internalHealthConfigured:Boolean(flowInternalUrl),publicRoute:'gated-until-independently-verified',workflow:['lead','qualify','quote','pay','fulfil','invoice','support','retain','report'],boundaries:['entity-and-platform-scoped','verified-payment-only','advisory-ai','replaceable-adapters'],privacy:{tracking:false,profiling:false,advertisingIdentifiers:false}}; }
async function proxyHealth(res,baseUrl,path,descriptor,errorPrefix){ if(!baseUrl)return json(res,503,{ok:false,error:errorPrefix+'_internal_route_not_configured',...descriptor}); try { const upstream=await fetch(baseUrl+path,{headers:{accept:'application/json'},signal:AbortSignal.timeout(3000)}); let body={}; try{body=await upstream.json();}catch{} return json(res,upstream.ok?200:502,{ok:upstream.ok&&body?.ok!==false,configured:true,engineIndependent:true,upstreamStatus:upstream.status,service:body}); } catch { return json(res,502,{ok:false,error:errorPrefix+'_internal_health_unreachable',configured:true,engineIndependent:true}); } }

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/','http://localhost');
  if(url.pathname==='/health')return json(res,200,{status:'ok',platform:'IZAKHONO ONE',engine:registry.engine,services:services.length,parallelPillars:parallel.length,serviceContracts:Object.keys(contracts).length,noTracking:true,policyGate:true,actionGate:true,notificationChannels:supportedNotificationChannels(),runtimeState:true,dispatcher:true,builderIntegration:{integrated:true,configured:Boolean(builderInternalUrl),engineIndependent:true},flowIntegration:{integrated:true,configured:Boolean(flowInternalUrl),engineIndependent:true}});
  if(url.pathname==='/api/contracts')return json(res,200,{ok:true,version:'v1',contracts:parallel.map(service=>({service_slug:service.slug,...contracts[service.slug]}))});
  if(url.pathname==='/api/runtime')return json(res,200,{ok:true,version:'v1',runtime:parallel.map(service=>publicRuntimeView(runtime.get(service.slug)))});
  if(url.pathname.startsWith('/api/runtime/')){const slug=decodeURIComponent(url.pathname.slice('/api/runtime/'.length));if(!runtime.has(slug))return json(res,404,{ok:false,error:'runtime_service_not_found'});return json(res,200,{ok:true,runtime:publicRuntimeView(runtime.get(slug))});}
  if(url.pathname==='/api/notifications/capabilities')return json(res,200,{ok:true,channels:supportedNotificationChannels()});
  if(url.pathname==='/api/action'&&req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;let input={};try{input=JSON.parse(body||'{}');}catch{return json(res,400,{ok:false,error:'invalid_json'});}const service=bySlug.get(String(input.service||''));if(!service||!contracts[service.slug])return json(res,404,{ok:false,error:'service_not_found'});const prepared=prepareAction({...input,service:service.slug});return json(res,prepared.policy.decision==='deny'?403:200,{...prepared,mode:'prepare_only',sideEffects:false});}
  if(url.pathname==='/api/dispatch'&&req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;let input={};try{input=JSON.parse(body||'{}');}catch{return json(res,400,{ok:false,error:'invalid_json'});}const service=bySlug.get(String(input.service||''));if(!service||!contracts[service.slug])return json(res,404,{ok:false,error:'service_not_found'});const prepared=prepareServiceDispatch({...input,service:service.slug,runtime:runtime.get(service.slug)});return json(res,prepared.policy?.decision==='deny'?403:200,prepared);}
  if(url.pathname.startsWith('/api/policy/')){const slug=decodeURIComponent(url.pathname.slice('/api/policy/'.length));const action=String(url.searchParams.get('action')||'').trim();const service=bySlug.get(slug);if(!service||!contracts[slug])return json(res,404,{error:'service_not_found'});if(!action)return json(res,400,{error:'action_required',service:slug});const known=action==='read'||supports(slug,action);const decision=known?'review':'deny';return json(res,200,{ok:true,service:slug,action,policy_class:contracts[slug].policy_class,decision,reason:known?'foundation_action_requires_service_policy':'unsupported_capability'});}
  if(url.pathname==='/api/builder')return json(res,200,builderDescriptor());
  if(url.pathname==='/api/builder/health')return proxyHealth(res,builderInternalUrl,'/api/health',builderDescriptor(),'builder');
  if(url.pathname==='/api/flow')return json(res,200,flowDescriptor());
  if(url.pathname==='/api/flow/health')return proxyHealth(res,flowInternalUrl,'/health',flowDescriptor(),'flow');
  if(url.pathname==='/api/search')return json(res,200,{query:url.searchParams.get('q')||'',results:search(url.searchParams.get('q')),count:search(url.searchParams.get('q')).length});
  if(url.pathname.startsWith('/api/resolve/')){const slug=decodeURIComponent(url.pathname.slice('/api/resolve/'.length));const service=bySlug.get(slug);return service?json(res,200,{...service,contract:contracts[slug]||null,runtime:runtime.has(slug)?publicRuntimeView(runtime.get(slug)):null}):json(res,404,{error:'service_not_found'});}
  if(url.pathname.startsWith('/api/route/')){const slug=decodeURIComponent(url.pathname.slice('/api/route/'.length));const service=bySlug.get(slug);if(!service)return json(res,404,{error:'service_not_found'});if(!service.publicUrl||!['verified','external-resilience','foundation'].includes(service.status))return json(res,409,{error:'route_not_publicly_verified',service});return json(res,200,{slug,route:service.publicUrl,status:service.status,runtime:runtime.has(slug)?publicRuntimeView(runtime.get(slug)):null});}
  let pathname=url.pathname==='/'?'/index.html':url.pathname;pathname=normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');const filePath=join(root,pathname);if(!filePath.startsWith(root))return json(res,403,{error:'forbidden'});try{const body=await readFile(filePath);res.writeHead(200,{'content-type':mime(filePath),'cache-control':pathname.endsWith('.html')?'no-cache':'public, max-age=300','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(body);}catch{json(res,404,{error:'not_found'});}
});
server.listen(port,'127.0.0.1',()=>{console.log('IZAKHONO_ONE_ENGINE=READY');console.log('PARALLEL_PILLARS='+parallel.length);console.log('SERVICE_CONTRACTS='+Object.keys(contracts).length);console.log('POLICY_GATE=READY');console.log('ACTION_GATE=READY');console.log('DISPATCHER=READY');console.log('NOTIFICATION_CHANNELS='+supportedNotificationChannels().length);console.log('RUNTIME_STATE=READY');console.log('BUILDER_INTEGRATION=READY');console.log('BUILDER_INTERNAL_ROUTE='+(builderInternalUrl?'CONFIGURED':'GATED'));console.log('FLOW_INTEGRATION=READY');console.log('FLOW_INTERNAL_ROUTE='+(flowInternalUrl?'CONFIGURED':'GATED'));console.log('PORT='+port);});
