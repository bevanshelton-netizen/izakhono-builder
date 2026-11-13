interface D1PreparedStatement { bind(...values: unknown[]): D1PreparedStatement; first<T = any>(): Promise<T | null>; all<T = any>(): Promise<{ results?: T[] }>; run(): Promise<unknown>; }
interface D1Database { prepare(query: string): D1PreparedStatement; }
interface Fetcher { fetch(request: Request): Promise<Response>; }

import { provisionOwnedSite, type HostProviderEnv } from './providers';

interface Env extends HostProviderEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  HOST_ADMIN_SECRET?: string;
  APP_ENV?: string;
  OWNED_EDGE_IPV4?: string;
  OWNED_EDGE_IPV6?: string;
  DNS_AUTHORITY_DOMAIN?: string;\n  DNS_SYNC_TOKEN?: string;
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
  // Authenticated read-only feed for the isolated authoritative-DNS sync agent.
  // Only explicitly active zones are eligible for publication; planned zones never answer publicly.
  if(url.pathname==='/internal/dns/snapshot' && req.method==='GET'){
    const supplied=(req.headers.get('authorization')||'').replace(/^Bearer\\s+/i,'');
    if(!env.DNS_SYNC_TOKEN || supplied!==env.DNS_SYNC_TOKEN) return json({ok:false,error:'Unauthorized'},401);
    const zones=await env.DB.prepare("SELECT id,zone_name,serial,primary_nameserver,secondary_nameserver FROM dns_zones WHERE status='active' ORDER BY zone_name LIMIT 1000").all<any>();
    const published=[];
    for(const zone of zones.results||[]){
      const records=await env.DB.prepare('SELECT name,type,ttl,priority,value,enabled FROM dns_records WHERE zone_id=? AND enabled=1 ORDER BY name,type').bind(zone.id).all<any>();
      published.push({...zone,records:records.results||[]});
    }
    return json({ok:true,schema_version:1,generated_at:new Date().toISOString(),zones:published});
  }

  if(!owner(req,env)) return json({ok:false,error:env.HOST_ADMIN_SECRET?'Unauthorized':'HOST_ADMIN_SECRET is not configured'},401);

  // Native DNS control-plane API. Zones remain planned until two authoritative
  // nodes and public registrar delegation have been independently verified.
  if(url.pathname==='/api/dns/zones' && req.method==='GET'){
    const rows=await env.DB.prepare('SELECT * FROM dns_zones ORDER BY created_at DESC LIMIT 500').all<any>();
    return json({ok:true,zones:rows.results||[]});
  }
  if(url.pathname==='/api/dns/zones' && req.method==='POST'){
    const b=await body(req);
    const customerId=clean(b.customer_id,120);
    const zoneName=clean(b.zone_name,253).toLowerCase().replace(/\.+$/,'');
    const authority=clean(env.DNS_AUTHORITY_DOMAIN,253).toLowerCase().replace(/\.+$/,'');
    if(!customerId || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(zoneName))
      return json({ok:false,error:'A valid customer_id and fully-qualified zone_name are required'},400);
    if(!authority || authority.endsWith('.invalid') || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(authority))
      return json({ok:false,error:'DNS_AUTHORITY_DOMAIN must be configured to a registered authority domain'},503);
    const customer=await env.DB.prepare('SELECT id FROM host_customers WHERE id=?').bind(customerId).first<any>();
    if(!customer) return json({ok:false,error:'Customer not found'},404);
    const id=uid('zone'), now=new Date().toISOString(), serial=Number(now.slice(0,10).replaceAll('-','')+'01');
    const primary='ns1.'+authority, secondary='ns2.'+authority;
    try{
      await env.DB.prepare('INSERT INTO dns_zones(id,customer_id,zone_name,status,serial,primary_nameserver,secondary_nameserver,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .bind(id,customerId,zoneName,'planned',serial,primary,secondary,now,now).run();
      await env.DB.prepare('INSERT INTO dns_records(id,zone_id,name,type,ttl,value,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .bind(uid('rec'),id,zoneName,'SOA',300,primary+'. hostmaster.'+zoneName+'. '+serial+' 3600 600 1209600 300',1,now,now).run();
      for(const ns of [primary,secondary]) await env.DB.prepare('INSERT INTO dns_records(id,zone_id,name,type,ttl,value,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .bind(uid('rec'),id,zoneName,'NS',300,ns+'.',1,now,now).run();
      await env.DB.prepare('INSERT INTO dns_audit_events(id,zone_id,action,actor,details_json,created_at) VALUES(?,?,?,?,?,?)')
        .bind(uid('dns_evt'),id,'zone.created','owner',JSON.stringify({zone_name:zoneName,status:'planned'}),now).run();
      return json({ok:true,zone:{id,customer_id:customerId,zone_name:zoneName,status:'planned',serial,primary_nameserver:primary,secondary_nameserver:secondary},public_authority:false},201);
    }catch(e){return json({ok:false,error:'Zone creation failed',detail:String(e)},409);}
  }
  const dnsZoneMatch=url.pathname.match(/^\/api\/dns\/zones\/([^/]+)$/);
  if(dnsZoneMatch && req.method==='GET'){
    const zoneId=decodeURIComponent(dnsZoneMatch[1]);
    const zone=await env.DB.prepare('SELECT * FROM dns_zones WHERE id=?').bind(zoneId).first<any>();
    if(!zone) return json({ok:false,error:'Zone not found'},404);
    const records=await env.DB.prepare('SELECT * FROM dns_records WHERE zone_id=? ORDER BY name,type').bind(zoneId).all<any>();
    return json({ok:true,zone,records:records.results||[]});
  }
  const dnsRecordsMatch=url.pathname.match(/^\/api\/dns\/zones\/([^/]+)\/records$/);
  if(dnsRecordsMatch && req.method==='POST'){
    const zoneId=decodeURIComponent(dnsRecordsMatch[1]), b=await body(req);
    const zone=await env.DB.prepare('SELECT * FROM dns_zones WHERE id=?').bind(zoneId).first<any>();
    if(!zone) return json({ok:false,error:'Zone not found'},404);
    const type=clean(b.type,8).toUpperCase(), name=clean(b.name,253).toLowerCase(), value=clean(b.value,4096), ttl=Number(b.ttl??300);
    if(!['A','NS','CNAME','MX','TXT'].includes(type)) return json({ok:false,error:'Record type is not supported by the current authoritative runtime'},400);
    if(!name || !value || !Number.isInteger(ttl) || ttl<30 || ttl>86400) return json({ok:false,error:'Invalid record name, value or TTL'},400);
    const fqdn=name==='@'?zone.zone_name:name.endsWith('.')?name.slice(0,-1):name+'.'+zone.zone_name;
    if(fqdn!==zone.zone_name && !fqdn.endsWith('.'+zone.zone_name)) return json({ok:false,error:'Record name must be inside its zone'},400);
    if(type==='A' && (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || value.split('.').some((part:string)=>Number(part)>255))) return json({ok:false,error:'A record must contain a valid IPv4 address'},400);
    if(type==='MX' && (!Number.isInteger(Number(b.priority)) || Number(b.priority)<0 || Number(b.priority)>65535)) return json({ok:false,error:'MX priority must be 0..65535'},400);
    if(type==='CNAME' && fqdn===zone.zone_name) return json({ok:false,error:'A zone apex cannot be a CNAME'},400);
    const conflicts=await env.DB.prepare('SELECT type FROM dns_records WHERE zone_id=? AND name=? AND enabled=1').bind(zoneId,fqdn).all<any>();
    if(type==='CNAME' && (conflicts.results||[]).length) return json({ok:false,error:'CNAME cannot coexist with other records at the same name'},409);
    if(type!=='CNAME' && (conflicts.results||[]).some((r:any)=>r.type==='CNAME')) return json({ok:false,error:'A CNAME already exists at this name'},409);
    const now=new Date().toISOString(), recordId=uid('rec'), serial=Number(zone.serial)+1;
    await env.DB.prepare('INSERT INTO dns_records(id,zone_id,name,type,ttl,priority,value,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .bind(recordId,zoneId,fqdn,type,ttl,type==='MX'?Number(b.priority):null,value,1,now,now).run();
    await env.DB.prepare('UPDATE dns_zones SET serial=?,updated_at=? WHERE id=?').bind(serial,now,zoneId).run();
    await env.DB.prepare("UPDATE dns_records SET value=? WHERE zone_id=? AND type='SOA' AND name=?")
      .bind(zone.primary_nameserver+'. hostmaster.'+zone.zone_name+'. '+serial+' 3600 600 1209600 300',zoneId,zone.zone_name).run();
    await env.DB.prepare('INSERT INTO dns_audit_events(id,zone_id,action,actor,details_json,created_at) VALUES(?,?,?,?,?,?)')
      .bind(uid('dns_evt'),zoneId,'record.created','owner',JSON.stringify({record_id:recordId,name:fqdn,type}),now).run();
    return json({ok:true,record:{id:recordId,zone_id:zoneId,name:fqdn,type,ttl,priority:type==='MX'?Number(b.priority):null,value,enabled:true},zone_serial:serial,applied_to_authority:false},201);
  }
  const dnsRecordMatch=url.pathname.match(/^\/api\/dns\/records\/([^/]+)$/);
  if(dnsRecordMatch && req.method==='DELETE'){
    const recordId=decodeURIComponent(dnsRecordMatch[1]);
    const record=await env.DB.prepare('SELECT * FROM dns_records WHERE id=?').bind(recordId).first<any>();
    if(!record) return json({ok:false,error:'Record not found'},404);
    if(['SOA','NS'].includes(record.type)) return json({ok:false,error:'System SOA/NS records cannot be deleted through this endpoint'},409);
    const now=new Date().toISOString(), zone=await env.DB.prepare('SELECT serial FROM dns_zones WHERE id=?').bind(record.zone_id).first<any>();
    await env.DB.prepare('DELETE FROM dns_records WHERE id=?').bind(recordId).run();
    const serial=Number(zone?.serial||0)+1;
    await env.DB.prepare('UPDATE dns_zones SET serial=?,updated_at=? WHERE id=?').bind(serial,now,record.zone_id).run();
    const zoneDetails=await env.DB.prepare('SELECT zone_name,primary_nameserver FROM dns_zones WHERE id=?').bind(record.zone_id).first<any>();
    if(zoneDetails) await env.DB.prepare("UPDATE dns_records SET value=? WHERE zone_id=? AND type='SOA' AND name=?")
      .bind(zoneDetails.primary_nameserver+'. hostmaster.'+zoneDetails.zone_name+'. '+serial+' 3600 600 1209600 300',record.zone_id,zoneDetails.zone_name).run();
    await env.DB.prepare('INSERT INTO dns_audit_events(id,zone_id,action,actor,details_json,created_at) VALUES(?,?,?,?,?,?)')
      .bind(uid('dns_evt'),record.zone_id,'record.deleted','owner',JSON.stringify({record_id:recordId,name:record.name,type:record.type}),now).run();
    return json({ok:true,deleted:recordId,zone_serial:serial,applied_to_authority:false});
  }

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
      await env.DB.prepare('INSERT INTO host_domains(id,customer_id,domain,registrar,dns_provider,verification_status) VALUES(?,?,?,?,?,?)').bind(domainId,customerId,domain,clean(b.registrar||'pending-owned-registrar',80),clean(b.dns_provider||'izakhono-network',80),'pending').run();
      await env.DB.prepare('INSERT INTO host_sites(id,customer_id,domain_id,name,deployment_provider,canonical_host,status,ssl_status) VALUES(?,?,?,?,?,?,?,?)').bind(siteId,customerId,domain,'izakhono-runtime','','planned','pending').run();
      await env.DB.prepare('INSERT INTO host_subscriptions(id,customer_id,plan_id,status) VALUES(?,?,?,?)').bind(uid('sub'),customerId,'plan_business','pending').run();
      await env.DB.prepare('INSERT INTO host_invoices(id,customer_id,invoice_number,amount_cents,currency,status) VALUES(?,?,?,?,?,?)').bind(invoiceId,customerId,invoiceNumber,54800,'ZAR','unpaid').run();

      // Provisioning is deliberately deferred until a trusted payment integration records
      // a verified settlement. Customer-supplied fields never authorize paid-state changes.
      await audit(env,customerId,'customer.onboarded',{domain,invoice_number:invoiceNumber,plan:'business',runtime:'izakhono-native'});
    }catch(e){ return json({ok:false,error:'Onboarding failed; retry safely',detail:String(e)},500); }
    return json({ok:true,customer_id:customerId,domain_id:domainId,site_id:siteId,invoice_id:invoiceId,invoice_number:invoiceNumber,amount_zar:548,monthly_zar:249,mailboxes:[],next_gates:['cleared payment','owned DNS verification','native site provision','HTTPS/SSL verification','mail provider activation']},201);
  }

  if(url.pathname==='/api/jobs' && req.method==='GET'){ const rows=await env.DB.prepare('SELECT * FROM host_jobs ORDER BY created_at DESC LIMIT 200').all<any>(); return json({ok:true,jobs:rows.results||[]}); }

  const runJob=url.pathname.match(/^\/api\/jobs\/([^/]+)\/run$/);
  if(runJob && req.method==='POST'){
    const jobId=decodeURIComponent(runJob[1]); const job=await env.DB.prepare('SELECT * FROM host_jobs WHERE id=?').bind(jobId).first<any>();
    if(!job) return json({ok:false,error:'Job not found'},404);
    if(job.job_type!=='invoice_issue') {
      const invoice=await env.DB.prepare("SELECT status FROM host_invoices WHERE customer_id=? ORDER BY created_at DESC LIMIT 1").bind(job.customer_id).first<any>();
      if(invoice?.status!=='paid') return json({ok:false,error:'Provisioning is locked until verified payment settlement',job_id:jobId,status:'queued'},409);
    }
    await env.DB.prepare("UPDATE host_jobs SET status='running',attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(jobId).run();
    try{
      const input=JSON.parse(job.input_json||'{}'); let result:any;
      if(job.job_type==='dns_apply'){
        result={status:'gated',provider:'izakhono-network',reason:'Native IZAKHONO NETWORK DNS API endpoint and credentials must be configured before applying customer DNS',records_requested:input.records?.length||0};
      } else if(job.job_type==='site_provision'){
        result=await provisionOwnedSite({domain:input.domain,source_ref:input.source_ref,site_id:input.site_id},env);
        await env.DB.prepare("UPDATE host_sites SET status=?,deployment_provider='izakhono-runtime',deployment_url=?,provider_project_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(result.site?.public_live?'verified':'planned',result.site?.deployment_url||'',result.site?.id||'',job.target_id).run();
      } else if(job.job_type==='ssl_verify') result={status:'gated',reason:'Promote only after owned edge returns valid public HTTPS evidence'};
      else if(job.job_type==='mailbox_provision') result={status:'gated',reason:'IZAKHONO mail plane activation is separately evidence-gated'};
      else if(job.job_type==='domain_register') result={status:'gated',reason:'Registrar ownership must be verified before registration is automated'};
      else if(job.job_type==='invoice_issue') result={status:'verified',reason:'Invoice is already represented in the HOST ledger'};
      else throw new Error('Unsupported job type');
      const finalStatus=job.job_type==='site_provision' && result.site?.public_live ? 'verified' : 'queued';
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

  if(url.pathname==='/api/provisioning-plan' && req.method==='GET') return json({ok:true,plan:{service:'IZAKHONO HOST',owned_first:true,reversible_external_fallback:true,stages:['customer + domain','owned DNS','native site runtime','HTTPS/SSL','IZAKHONO mail','billing + payment reconciliation','acceptance evidence'],provider_adapters:{registrar:'replaceable-registrar',dns:'izakhono-network-native-api',deployment:'izakhono-native-runtime',mail:'izakhono-mail',payments:'ikhokha-or-payfast'}}});
  return json({ok:false,error:'Not found'},404);
}

export default { async fetch(req:Request,env:Env){ const url=new URL(req.url); if(url.pathname.startsWith('/api/')){try{return await api(req,env,url);}catch(e){return json({ok:false,error:e instanceof Error?e.message:'Unexpected error'},500);}} return env.ASSETS.fetch(req); } };
