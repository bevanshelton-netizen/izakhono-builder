interface D1PreparedStatement { bind(...values: unknown[]): D1PreparedStatement; first<T = any>(): Promise<T | null>; all<T = any>(): Promise<{ results?: T[] }>; run(): Promise<unknown>; }
interface D1Database { prepare(query: string): D1PreparedStatement; }
interface Fetcher { fetch(request: Request): Promise<Response>; }

import { applyCloudflareDns, provisionOwnedSite, type HostProviderEnv } from './providers';

interface Env extends HostProviderEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  HOST_ADMIN_SECRET?: string;
  APP_ENV?: string;
  OWNED_EDGE_IPV4?: string;
  OWNED_EDGE_IPV6?: string;
}

const STATUS = new Set(['planned','queued','running','verified','failed','paused']);
const JOBS = new Set(['domain_register','dns_apply','site_provision','ssl_verify','mailbox_provision','invoice_issue']);
function uid(prefix:string){ return prefix+'_'+crypto.randomUUID().replaceAll('-',''); }
function clean(v:unknown,max=500){ return typeof v==='string' ? v.trim().slice(0,max) : ''; }
function json(data:unknown,status=200){ return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}}); }
function owner(req:Request,env:Env){ const supplied=req.headers.get('x-host-admin-secret')||''; return Boolean(env.HOST_ADMIN_SECRET && supplied===env.HOST_ADMIN_SECRET); }
async function body(req:Request){ if(!(req.headers.get('content-type')||'').includes('application/json')) throw new Error('Expected application/json'); return req.json() as Promise<any>; }
async function audit(env:Env,customerId:string|null,eventType:string,detail:any={}){ await env.DB.prepare('INSERT INTO host_audit_events(id,customer_id,event_type,actor,detail_json) VALUES(?,?,?,?,?)').bind(uid('evt'),customerId,eventType,'owner',JSON.stringify(detail).slice(0,8000)).run(); }

async function api(req:Request,env:Env,url:URL):Promise<Response>{
  if(req.method==='OPTIONS') return json({ok:true},204);
  if(url.pathname==='/api/health' && req.method==='GET'){
    try{ const probe=await env.DB.prepare('SELECT 1 AS ok').first<any>(); return json({ok:probe?.ok===1,service:'IZAKHONO HOST',version:'0.2.0',runtime:'izakhono-native',environment:env.APP_ENV||'production'}); }
    catch{return json({ok:false,service:'IZAKHONO HOST',database:'error'},503);}
  }
  if(!owner(req,env)) return json({ok:false,error:env.HOST_ADMIN_SECRET?'Unauthorized':'HOST_ADMIN_SECRET is not configured'},401);

  if(url.pathname==='/api/dashboard' && req.method==='GET'){
    const [customers,domains,sites,jobs,invoices]=await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS n FROM host_customers').first<any>(), env.DB.prepare('SELECT COUNT(*) AS n FROM host_domains').first<any>(),
      env.DB.prepare('SELECT COUNT(*) AS n FROM host_sites').first<any>(), env.DB.prepare("SELECT COUNT(*) AS n FROM host_jobs WHERE status IN ('queued','running')").first<any>(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM host_invoices WHERE status='unpaid'").first<any>()
    ]);
    const [customer,domain,site]=await Promise.all([
      env.DB.prepare('SELECT * FROM host_customers ORDER BY created_at DESC LIMIT 1').first<any>(),
      env.DB.prepare('SELECT * FROM host_domains ORDER BY created_at DESC LIMIT 1').first<any>(),
      env.DB.prepare('SELECT * FROM host_sites ORDER BY created_at DESC LIMIT 1').first<any>()
    ]);
    return json({ok:true,metrics:{customers:Number(customers?.n||0),domains:Number(domains?.n||0),sites:Number(sites?.n||0),active_jobs:Number(jobs?.n||0),unpaid_invoices:Number(invoices?.n||0)},latest:{customer,domain,site}});
  }

  if(url.pathname==='/api/customers' && req.method==='GET'){
    const rows=await env.DB.prepare('SELECT * FROM host_customers ORDER BY created_at DESC LIMIT 200').all<any>(); return json({ok:true,customers:rows.results||[]});
  }

  if(url.pathname==='/api/onboard' && req.method==='POST'){
    const b=await body(req); const legalName=clean(b.legal_name,180), tradingName=clean(b.trading_name,180), domain=clean(b.domain,253).toLowerCase(), email=clean(b.email,320).toLowerCase();
    if(!legalName || !domain || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain)) return json({ok:false,error:'Legal name and a valid domain are required'},400);
    const customerId=uid('cus'), domainId=uid('dom'), siteId=uid('site'), invoiceId=uid('inv');
    const invoiceNumber='IZH-'+domain.split('.')[0].toUpperCase()+'-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.floor(Math.random()*900+100);
    try{
      await env.DB.prepare('INSERT INTO host_customers(id,legal_name,trading_name,email,phone) VALUES(?,?,?,?,?)').bind(customerId,legalName,tradingName,email,clean(b.phone,60)).run();
      await env.DB.prepare('INSERT INTO host_domains(id,customer_id,domain,registrar,dns_provider,verification_status) VALUES(?,?,?,?,?,?)').bind(domainId,customerId,domain,clean(b.registrar||'Cloudflare',80),clean(b.dns_provider||'Cloudflare',80),'pending').run();
      await env.DB.prepare('INSERT INTO host_sites(id,customer_id,domain_id,name,deployment_provider,canonical_host,status,ssl_status) VALUES(?,?,?,?,?,?,?,?)').bind(siteId,customerId,domain,'izakhono-runtime',domain,'planned','pending').run();
      await env.DB.prepare('INSERT INTO host_subscriptions(id,customer_id,plan_id,status) VALUES(?,?,?,?)').bind(uid('sub'),customerId,'plan_business','pending').run();
      await env.DB.prepare('INSERT INTO host_invoices(id,customer_id,invoice_number,amount_cents,currency,status) VALUES(?,?,?,?,?,?)').bind(invoiceId,customerId,invoiceNumber,54800,'ZAR','unpaid').run();

      const dnsRecords:any[]=[];
      if(env.OWNED_EDGE_IPV4) dnsRecords.push({type:'A',name:'@',content:env.OWNED_EDGE_IPV4,ttl:60,proxied:false});
      if(env.OWNED_EDGE_IPV6) dnsRecords.push({type:'AAAA',name:'@',content:env.OWNED_EDGE_IPV6,ttl:60,proxied:false});
      if(dnsRecords.length) await env.DB.prepare('INSERT INTO host_jobs(id,customer_id,job_type,target_id,provider,input_json) VALUES(?,?,?,?,?,?)').bind(uid('job'),customerId,'dns_apply',domainId,'cloudflare',JSON.stringify({domain,records:dnsRecords})).run();
      else await env.DB.prepare('INSERT INTO host_jobs(id,customer_id,job_type,target_id,provider,input_json) VALUES(?,?,?,?,?,?)').bind(uid('job'),customerId,'dns_apply',domainId,'pending-owned-dns',JSON.stringify({domain,records:[],reason:'OWNED_EDGE_IPV4/6 not configured'})).run();

      await env.DB.prepare('INSERT INTO host_jobs(id,customer_id,job_type,target_id,provider,input_json) VALUES(?,?,?,?,?,?)').bind(uid('job'),customerId,'site_provision',siteId,'izakhono-native',JSON.stringify({domain,source_ref:clean(b.source_ref||'internal',200),site_id:siteId})).run();
      await env.DB.prepare('INSERT INTO host_jobs(id,customer_id,job_type,target_id,provider,input_json) VALUES(?,?,?,?,?,?)').bind(uid('job'),customerId,'ssl_verify',siteId,'izakhono-edge',JSON.stringify({domain})).run();
      for(const address of ['info','calvin','projects','diamonds','tenders']) await env.DB.prepare('INSERT INTO host_mailboxes(id,customer_id,domain_id,address,provider,status) VALUES(?,?,?,?,?,?)').bind(uid('mb'),customerId,domainId,address+'@'+domain,'izakhono-mail','planned').run();
      await audit(env,customerId,'customer.onboarded',{domain,invoice_number:invoiceNumber,plan:'business',runtime:'izakhono-native'});
    }catch(e){ return json({ok:false,error:'Onboarding failed; retry safely',detail:String(e)},500); }
    return json({ok:true,customer_id:customerId,domain_id:domainId,site_id:siteId,invoice_id:invoiceId,invoice_number:invoiceNumber,amount_zar:548,monthly_zar:249,mailboxes:['info','calvin','projects','diamonds','tenders'].map(x=>x+'@'+domain),next_gates:['cleared payment','owned DNS verification','native site provision','HTTPS/SSL verification','mail provider activation']},201);
  }

  if(url.pathname==='/api/jobs' && req.method==='GET'){ const rows=await env.DB.prepare('SELECT * FROM host_jobs ORDER BY created_at DESC LIMIT 200').all<any>(); return json({ok:true,jobs:rows.results||[]}); }

  const runJob=url.pathname.match(/^\/api\/jobs\/([^/]+)\/run$/);
  if(runJob && req.method==='POST'){
    const jobId=decodeURIComponent(runJob[1]); const job=await env.DB.prepare('SELECT * FROM host_jobs WHERE id=?').bind(jobId).first<any>();
    if(!job) return json({ok:false,error:'Job not found'},404);
    await env.DB.prepare("UPDATE host_jobs SET status='running',attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(jobId).run();
    try{
      const input=JSON.parse(job.input_json||'{}'); let result:any;
      if(job.job_type==='dns_apply'){
        if(!input.records?.length) throw new Error('Owned edge addresses are not configured; DNS job remains gated');
        result=await applyCloudflareDns(input.domain,input.records,env);
      } else if(job.job_type==='site_provision'){
        result=await provisionOwnedSite({domain:input.domain,source_ref:input.source_ref,site_id:input.site_id},env);
        await env.DB.prepare("UPDATE host_sites SET status=?,deployment_provider='izakhono-runtime',deployment_url=?,provider_project_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(result.site?.public_live?'verified':'planned',result.site?.deployment_url||'',result.site?.id||'',job.target_id).run();
      } else if(job.job_type==='ssl_verify') result={status:'gated',reason:'Promote only after owned edge returns valid public HTTPS evidence'};
      else if(job.job_type==='mailbox_provision') result={status:'gated',reason:'IZAKHONO mail plane activation is separately evidence-gated'};
      else if(job.job_type==='domain_register') result={status:'gated',reason:'Registrar ownership must be verified before registration is automated'};
      else if(job.job_type==='invoice_issue') result={status:'verified',reason:'Invoice is already represented in the HOST ledger'};
      else throw new Error('Unsupported job type');
      const finalStatus=job.job_type==='dns_apply' ? 'verified' : job.job_type==='site_provision' && result.site?.public_live ? 'verified' : 'queued';
      await env.DB.prepare('UPDATE host_jobs SET status=?,result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(finalStatus,JSON.stringify(result).slice(0,12000),jobId).run();
      await audit(env,job.customer_id,'job.executed',{job_id:jobId,job_type:job.job_type,status:finalStatus});
      return json({ok:true,job_id:jobId,status:finalStatus,result});
    }catch(e){
      const message=e instanceof Error?e.message:'Provider execution failed';
      await env.DB.prepare("UPDATE host_jobs SET status='failed',result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify({error:message}).slice(0,8000),jobId).run();
      await audit(env,job.customer_id,'job.failed',{job_id:jobId,job_type:job.job_type,error:message});
      return json({ok:false,error:message,job_id:jobId},502);
    }
  }

  const jobMatch=url.pathname.match(/^\/api\/jobs\/([^/]+)\/status$/);
  if(jobMatch && req.method==='PATCH'){
    const idv=decodeURIComponent(jobMatch[1]); const b=await body(req); const status=clean(b.status,30); if(!STATUS.has(status)) return json({ok:false,error:'Invalid job status'},400);
    await env.DB.prepare('UPDATE host_jobs SET status=?,result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,JSON.stringify(b.result||{}).slice(0,8000),idv).run();
    await audit(env,null,'job.status_changed',{job_id:idv,status}); return json({ok:true,id:idv,status});
  }

  if(url.pathname==='/api/provisioning-plan' && req.method==='GET') return json({ok:true,plan:{service:'IZAKHONO HOST',owned_first:true,reversible_external_fallback:true,stages:['customer + domain','owned DNS','native site runtime','HTTPS/SSL','IZAKHONO mail','billing + payment reconciliation','acceptance evidence'],provider_adapters:{registrar:'replaceable-registrar',dns:'cloudflare-adapter-or-owned-authority',deployment:'izakhono-native-runtime',mail:'izakhono-mail',payments:'ikhokha-or-payfast'}}});
  return json({ok:false,error:'Not found'},404);
}

export default { async fetch(req:Request,env:Env){ const url=new URL(req.url); if(url.pathname.startsWith('/api/')){try{return await api(req,env,url);}catch(e){return json({ok:false,error:e instanceof Error?e.message:'Unexpected error'},500);}} return env.ASSETS.fetch(req); } };
