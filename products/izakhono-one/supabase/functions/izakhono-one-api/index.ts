
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type, apikey, authorization","Access-Control-Allow-Methods":"POST,GET,OPTIONS"};
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const base=Deno.env.get("SUPABASE_URL")||"";
const secret=(()=>{try{const x=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");if(x.default)return x.default}catch{}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""})();
const txt=(v,n=1200)=>String(v??"").trim().slice(0,n);
const rand=(n=24)=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return[...a].map(x=>x.toString(16).padStart(2,"0")).join("")};
async function sha(v){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function db(path,method="GET",body){const r=await fetch(base+"/rest/v1/"+path,{method,headers:{apikey:secret,"Content-Type":"application/json",Prefer:"return=representation"},body:body?JSON.stringify(body):undefined});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(typeof d==="object"?(d.message||d.hint||JSON.stringify(d)):String(d));return d}
function slugify(v){return txt(v,80).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48)||"business"}
async function centralByHash(h){const r=await db("vf_one_accounts?select=*&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1");return r?.[0]||null}
async function owner(token){if(!token)throw new Error("Owner token required.");const h=await sha(token),a=await centralByHash(h);if(!a)throw new Error("Invalid IZAKHONO ONE token.");return{a,h}}
async function ensureModules(h,business,email,currency="ZAR"){
 const proof=await db("vf_proofforge_accounts?select=id&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1");
 if(!proof?.[0])await db("vf_proofforge_accounts","POST",{public_slug:slugify(business)+"-"+rand(4),access_token_hash:h,business_name:business,owner_email:email,plan:"starter",status:"active"});
 const cash=await db("vf_cashforge_accounts?select=id&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1");
 if(!cash?.[0])await db("vf_cashforge_accounts","POST",{access_token_hash:h,business_name:business,owner_email:email,currency});
 const margin=await db("vf_marginforge_accounts?select=id&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1");
 if(!margin?.[0])await db("vf_marginforge_accounts","POST",{access_token_hash:h,business_name:business,owner_email:email,currency});
}
async function moduleIdentity(h){
 const [proof,cash,margin]=await Promise.all([
  db("vf_proofforge_accounts?select=business_name,owner_email&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1"),
  db("vf_cashforge_accounts?select=business_name,owner_email&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1"),
  db("vf_marginforge_accounts?select=business_name,owner_email&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1")
 ]);
 return proof?.[0]||cash?.[0]||margin?.[0]||null;
}
async function attachPartnerReferral(a,email,code){
 code=txt(code,32).toUpperCase();if(!code)return null;
 const p=(await db("vf_partner_accounts?select=id,status&public_referral_code=eq."+encodeURIComponent(code)+"&limit=1"))?.[0];
 if(!p||["suspended","closed"].includes(p.status))return null;
 const ex=(await db("vf_partner_client_links?select=id&one_account_id=eq."+a.id+"&limit=1"))?.[0];
 if(!ex)await db("vf_partner_client_links","POST",{partner_id:p.id,one_account_id:a.id,relationship_type:"referral",status:"active"});
 let ref=(await db("vf_partner_referrals?select=id&partner_id=eq."+p.id+"&email=ilike."+encodeURIComponent(email)+"&order=created_at.desc&limit=1"))?.[0];
 if(ref)await db("vf_partner_referrals?id=eq."+ref.id,"PATCH",{status:"registered",one_account_id:a.id,updated_at:new Date().toISOString()});
 else await db("vf_partner_referrals","POST",{partner_id:p.id,business_name:a.business_name,email,status:"registered",one_account_id:a.id});
 await db("vf_partner_events","POST",{partner_id:p.id,event_type:"client_registered",detail:{one_account_id:a.id}});
 return p.id;
}

const onboardKeys=["business_profile_complete","opening_cash_complete","customers_imported","receivables_loaded","expenses_loaded","payroll_configured","insurance_review_started","first_quote_created","first_invoice_created","first_forecast_viewed"];
const onboardLabels={
 business_profile_complete:"Complete your business profile",
 opening_cash_complete:"Confirm your opening cash position",
 customers_imported:"Add your first customers or leads",
 receivables_loaded:"Load outstanding customer invoices",
 expenses_loaded:"Add recurring and current business expenses",
 payroll_configured:"Configure payroll if you employ people",
 insurance_review_started:"Review worker, asset and business protection",
 first_quote_created:"Create your first profitable quote",
 first_invoice_created:"Create or load your first invoice",
 first_forecast_viewed:"Open SUPER CFO and review the 13-week forecast"
};
async function ensureOnboarding(a){
 let row=(await db("vf_one_onboarding?select=*&account_id=eq."+a.id+"&limit=1"))?.[0];
 if(!row)row=(await db("vf_one_onboarding","POST",{account_id:a.id,business_profile_complete:!!(a.business_name&&a.owner_email&&a.base_currency),completion_pct:a.business_name&&a.owner_email&&a.base_currency?10:0,next_best_action:"Confirm your opening cash position"}))[0];
 return row;
}
function onboardCalc(row){
 const done=onboardKeys.filter(k=>!!row[k]).length,pct=Math.round(done/onboardKeys.length*100);
 const next=onboardKeys.find(k=>!row[k]);
 return{completion_pct:pct,next_best_action:next?onboardLabels[next]:"Onboarding complete",activated_at:pct>=60?(row.activated_at||new Date().toISOString()):row.activated_at||null};
}
async function requireGrowthAdmin(a){
 const p=(await db("vf_internal_owner_permissions?select=permission&account_id=eq."+a.id+"&permission=eq.growth_admin&limit=1"))?.[0];
 if(!p)throw new Error("Growth admin permission required.");
}
async function growthDashboard(a){
 await requireGrowthAdmin(a);
 const since=new Date(Date.now()-30*86400000).toISOString();
 const [platforms,events,leads,tasks,experiments,campaigns,oneHealth,oneAccounts]=await Promise.all([
  db("iz_portfolio_growth_platforms?select=slug,display_name,category,primary_goal,primary_cta,conversion_event,revenue_model,starting_price_cents,currency,public_url,campaign_url,status,launch_stage,instrumentation_mode,funnel_type&order=display_name.asc"),
  db("iz_portfolio_growth_events?select=platform_slug,event_name,utm_source,utm_medium,utm_campaign,amount_cents,currency,occurred_at&occurred_at=gte."+encodeURIComponent(since)+"&order=occurred_at.desc&limit=5000"),
  db("iz_portfolio_growth_leads?select=id,platform_slug,contact_name,business_name,email,phone,intent,lead_type,status,lead_quality,utm_source,utm_medium,utm_campaign,created_at&order=created_at.desc&limit=500"),
  db("iz_portfolio_growth_tasks?select=id,platform_slug,task_key,title,detail,priority,status,due_on&status=in.(open,in_progress,blocked)&order=priority.asc,created_at.asc&limit=200"),
  db("iz_portfolio_growth_experiments?select=id,platform_slug,experiment_key,hypothesis,variant_a,variant_b,success_event,status&status=in.(planned,running)&order=created_at.asc&limit=200"),
  db("iz_portfolio_campaign_queue?select=id,platform_slug,campaign_key,objective,audience,hook,body_copy,cta,landing_url,recommended_channels,hashtags,media_brief,status&status=in.(ready,draft)&order=created_at.asc&limit=100"),
  db("vf_business_health_checks?select=id,business_name,contact_name,email,phone,score,recommended_plan,lead_quality,marketing_consent,status,created_at&created_at=gte."+encodeURIComponent(since)+"&order=created_at.desc&limit=500"),
  db("vf_one_accounts?select=id,business_name,owner_email,plan,subscription_status,created_at&created_at=gte."+encodeURIComponent(since)+"&order=created_at.desc&limit=500")
 ]);
 const config=new Map(platforms.map(p=>[p.slug,p]));
 const by={};
 for(const p of platforms)by[p.slug]={slug:p.slug,display_name:p.display_name,status:p.status,launch_stage:p.launch_stage,instrumentation_mode:p.instrumentation_mode,page_views:0,cta_clicks:0,shares:0,leads:0,conversions:0,revenue_cents:0,currency:p.currency||"ZAR",primary_cta:p.primary_cta,public_url:p.public_url,campaign_url:p.campaign_url};
 for(const e of events){
  if(!by[e.platform_slug])continue;
  const x=by[e.platform_slug],p=config.get(e.platform_slug);
  if(e.event_name==="page_view")x.page_views++;
  if(e.event_name==="cta_click")x.cta_clicks++;
  if(e.event_name==="share")x.shares++;
  if(e.event_name==="lead_submitted")x.leads++;
  if(p&&e.event_name===p.conversion_event)x.conversions++;
  if(e.event_name==="payment_verified")x.revenue_cents+=+e.amount_cents||0;
 }
 const sourceMap={};
 for(const e of events){
  const k=e.utm_source||"direct";sourceMap[k]=(sourceMap[k]||0)+1;
 }
 // Privacy-safe ONE operational metrics: explicit submissions/accounts only; no passive visitor tracking.
 if(by["izakhono-one"]){
   by["izakhono-one"].page_views=0;
   by["izakhono-one"].cta_clicks=0;
   by["izakhono-one"].shares=0;
   by["izakhono-one"].leads=oneHealth.length;
   by["izakhono-one"].conversions=oneAccounts.filter(x=>x.subscription_status==="active").length;
 }
 const arr=Object.values(by);
 return{
  period_days:30,
  totals:{
   platforms:platforms.length,
   page_views:arr.reduce((s,x)=>s+x.page_views,0),
   cta_clicks:arr.reduce((s,x)=>s+x.cta_clicks,0),
   leads:leads.filter(x=>new Date(x.created_at)>=new Date(since)).length + oneHealth.length,
   conversions:arr.reduce((s,x)=>s+x.conversions,0),
   verified_revenue_cents:arr.reduce((s,x)=>s+x.revenue_cents,0),
   bridge_instrumented:platforms.filter(p=>p.instrumentation_mode==="bridge").length,
   open_growth_tasks:tasks.length,
   planned_experiments:experiments.length,
   ready_campaigns:campaigns.filter(x=>x.status==="ready").length
  },
  platforms:arr.sort((x,y)=>(y.conversions+y.leads+y.page_views)-(x.conversions+x.leads+x.page_views)),
  sources:Object.entries(sourceMap).map(([source,count])=>({source,count})).sort((x,y)=>y.count-x.count).slice(0,20),
  leads:[
    ...oneHealth.map(x=>({id:x.id,platform_slug:"izakhono-one",contact_name:x.contact_name||x.business_name,business_name:x.business_name,email:x.email,phone:x.phone,intent:"Business Health Check · "+x.score+"/100 · "+x.recommended_plan,lead_type:"health_check",status:x.status,lead_quality:x.lead_quality,utm_source:null,utm_medium:null,utm_campaign:null,created_at:x.created_at,marketing_consent:x.marketing_consent})),
    ...leads
  ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,80),
  tasks:tasks.slice(0,100),
  experiments:experiments.slice(0,100),
  campaigns:campaigns.slice(0,100)
 };
}
async function dailyBrief(a,h){
 const d=await dashboard(a,h),date=new Date().toISOString().slice(0,10),headline=d.focus?.[0]?.title||"Business controls are clear today";
 const body={priority_items:d.focus||[],metrics:d.metrics||{},headline,generated_at:new Date().toISOString()};
 const ex=(await db("vf_one_daily_briefs?select=id&account_id=eq."+a.id+"&brief_date=eq."+date+"&limit=1"))?.[0];
 let row;
 if(ex)row=(await db("vf_one_daily_briefs?id=eq."+ex.id,"PATCH",body))[0];
 else row=(await db("vf_one_daily_briefs","POST",{account_id:a.id,brief_date:date,...body}))[0];
 return{brief:row,account:d.account};
}

async function dashboard(a,h){
 const [marginAcc,cashAcc,proofAcc,leads]=await Promise.all([
  db("vf_marginforge_accounts?select=id&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1"),
  db("vf_cashforge_accounts?select=id&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1"),
  db("vf_proofforge_accounts?select=id,public_slug&access_token_hash=eq."+encodeURIComponent(h)+"&limit=1"),
  db("vf_one_leads?select=*&account_id=eq."+a.id+"&order=created_at.desc&limit=100")
 ]);
 let quotes=[],invoices=[],requests=[],testimonials=[];
 if(marginAcc?.[0])quotes=await db("vf_marginforge_quotes?select=id,status,total_inc_vat_cents,gross_profit_cents,customer_name,title,created_at&account_id=eq."+marginAcc[0].id+"&order=created_at.desc&limit=100");
 if(cashAcc?.[0])invoices=await db("vf_cashforge_invoices?select=id,status,amount_cents,due_date,promise_date,customer_name,invoice_number,created_at&account_id=eq."+cashAcc[0].id+"&order=created_at.desc&limit=100");
 if(proofAcc?.[0]){
   [requests,testimonials]=await Promise.all([
     db("vf_proofforge_requests?select=id,status,customer_name,created_at&account_id=eq."+proofAcc[0].id+"&order=created_at.desc&limit=100"),
     db("vf_proofforge_testimonials?select=id,status,rating,permission_public,customer_name,created_at&account_id=eq."+proofAcc[0].id+"&order=created_at.desc&limit=100")
   ]);
 }
 const today=new Date();today.setHours(12,0,0,0);
 const day=s=>{const d=new Date(String(s)+"T12:00:00");return Math.round((today-d)/86400000)};
 const openInv=invoices.filter(x=>!["paid","written_off"].includes(x.status));
 const overdue=openInv.filter(x=>day(x.due_date)>0);
 const dueSoon=openInv.filter(x=>day(x.due_date)<=0&&day(x.due_date)>=-7);
 const claimed=openInv.filter(x=>x.status==="payment_claimed");
 const changes=quotes.filter(x=>x.status==="changes_requested");
 const pending=testimonials.filter(x=>x.status==="pending");
 const leadOpen=leads.filter(x=>!["won","lost"].includes(x.status));
 const focus=[];
 if(overdue.length)focus.push({kind:"collect",priority:1,title:overdue.length+" overdue invoice"+(overdue.length===1?"":"s"),detail:"R"+Math.round(overdue.reduce((s,x)=>s+(+x.amount_cents||0),0)/100).toLocaleString("en-ZA")+" needs collection attention"});
 if(claimed.length)focus.push({kind:"collect",priority:1,title:claimed.length+" payment claim"+(claimed.length===1?"":"s")+" to verify",detail:"Confirm bank receipt before closing"});
 if(changes.length)focus.push({kind:"quote",priority:2,title:changes.length+" quote change request"+(changes.length===1?"":"s"),detail:"Revise and resend while the customer is engaged"});
 if(pending.length)focus.push({kind:"proof",priority:3,title:pending.length+" testimonial"+(pending.length===1?"":"s")+" awaiting review",detail:"Approve genuine proof you are comfortable publishing"});
 if(leadOpen.length)focus.push({kind:"sell",priority:4,title:leadOpen.length+" active lead"+(leadOpen.length===1?"":"s"),detail:"Move the next conversation forward"});
 if(!focus.length)focus.push({kind:"sell",priority:5,title:"Your desk is clear",detail:"Create a lead or quote to start the flow"});
 return{
  account:{business_name:a.business_name,owner_email:a.owner_email,plan:a.plan,public_slug:a.public_slug,country_code:a.country_code,base_currency:a.base_currency,subscription_status:a.subscription_status||"trial",current_period_end:a.current_period_end||null,billing_provider:a.billing_provider||null},
  metrics:{
   active_leads:leadOpen.length,
   quote_pipeline:quotes.filter(x=>!["declined","expired"].includes(x.status)).length,
   quoted_value_cents:quotes.reduce((s,x)=>s+(+x.total_inc_vat_cents||0),0),
   overdue_count:overdue.length,
   overdue_cents:overdue.reduce((s,x)=>s+(+x.amount_cents||0),0),
   proof_pending:pending.length,
   approved_proof:testimonials.filter(x=>x.status==="approved"&&x.permission_public).length
  },
  focus:focus.sort((x,y)=>x.priority-y.priority).slice(0,6),
  recent:{leads:leads.slice(0,8),quotes:quotes.slice(0,8),invoices:invoices.slice(0,8),testimonials:testimonials.slice(0,8)},
  modules:{proof_slug:proofAcc?.[0]?.public_slug||null,due_soon:dueSoon.length}
 };
}

function metricNum(v){return Math.max(0,Math.round(Number(v)||0))}
function metricDays(v){const n=Math.round(Number(v)||30);return Math.min(90,Math.max(1,n))}
function metricRate(a,b){return b>0?Math.round((a/b)*10000)/100:0}
function metricLabel(score){if(score>=75)return "PUSH HARD";if(score>=60)return "MARKET NOW";if(score>=45)return "FIX & TEST";return "BUILD / VERIFY"}
async function metricsDashboard(a,days){
  await requireGrowthAdmin(a);
  days=metricDays(days);
  const since=new Date(Date.now()-days*86400000).toISOString(),daySince=since.slice(0,10);
  const growth=await growthDashboard(a);
  const [cfgs,warehouse,sources,targets,runs,social]=await Promise.all([
    db("iz_portfolio_growth_platforms?select=slug,display_name,category,starting_price_cents,currency,status,launch_stage,instrumentation_mode,tracking_enabled,public_url,campaign_url&order=display_name.asc"),
    db("iz_metrics_daily?select=metric_date,source_key,platform_slug,channel,spend_cents,impressions,reach,clicks,engagements,video_views,leads,conversions,revenue_cents,currency&metric_date=gte."+daySince+"&limit=20000"),
    db("iz_metrics_sources?select=source_key,display_name,provider,channel_class,status,auth_mode,last_sync_at,last_success_at,last_error,config&order=provider.asc,display_name.asc"),
    db("iz_metrics_targets?select=platform_slug,priority_weight,weekly_revenue_target_cents,weekly_lead_target,weekly_conversion_target,max_cpa_cents"),
    db("iz_metrics_sync_runs?select=source_key,status,started_at,finished_at,rows_received,rows_upserted,error_message&order=started_at.desc&limit=30"),
    db("social_analytics_daily?select=metric_date,impressions,reach,clicks,likes,comments,shares,saves,video_views,leads,revenue_cents&metric_date=gte."+daySince+"&limit=10000")
  ]);
  const by={},cmap={},tmap={};
  for(const c of cfgs||[])cmap[c.slug]=c;
  for(const t of targets||[])tmap[t.platform_slug]=t;
  for(const p of growth.platforms||[])by[p.slug]={...p,spend_cents:0,impressions:0,clicks:0,engagements:0,video_views:0,external_leads:0,external_conversions:0,external_revenue_cents:0};
  for(const m of warehouse||[]){const x=by[m.platform_slug];if(!x)continue;x.spend_cents+=metricNum(m.spend_cents);x.impressions+=metricNum(m.impressions);x.clicks+=metricNum(m.clicks);x.engagements+=metricNum(m.engagements);x.video_views+=metricNum(m.video_views);x.external_leads+=metricNum(m.leads);x.external_conversions+=metricNum(m.conversions);x.external_revenue_cents+=metricNum(m.revenue_cents)}
  const priority=[];
  for(const slug of Object.keys(by)){
    const x=by[slug],c=cmap[slug]||{},target=tmap[slug]||{};
    const totalLeads=metricNum(x.leads)+metricNum(x.external_leads),totalConv=metricNum(x.conversions)+metricNum(x.external_conversions),totalRev=metricNum(x.revenue_cents)+metricNum(x.external_revenue_cents);
    const readiness=(c.status==="active"?15:0)+(c.launch_stage==="public"?15:0)+((c.public_url||c.campaign_url)?10:0)+(c.tracking_enabled?10:0)+(c.instrumentation_mode!=="registry_only"?10:0);
    const traction=Math.min(8,metricNum(x.page_views)/50)+Math.min(6,totalLeads*2)+Math.min(6,totalConv*3);
    const economics=(metricNum(c.starting_price_cents)>0?10:0)+(totalRev>0?10:0);
    const raw=Math.round(Math.min(100,readiness+traction+economics)),weight=Number(target.priority_weight||1),score=Math.round(Math.min(100,raw*weight));
    priority.push({...x,category:c.category||null,starting_price_cents:metricNum(c.starting_price_cents),total_leads:totalLeads,total_conversions:totalConv,total_revenue_cents:totalRev,readiness_score:Math.round(readiness),opportunity_score:score,action:metricLabel(score),ctr_pct:metricRate(metricNum(x.clicks),metricNum(x.impressions)),conversion_pct:metricRate(totalConv,Math.max(1,metricNum(x.clicks)+metricNum(x.cta_clicks))),cpa_cents:totalConv>0?Math.round(metricNum(x.spend_cents)/totalConv):null,roas:metricNum(x.spend_cents)>0?Math.round((totalRev/metricNum(x.spend_cents))*100)/100:null,target})
  }
  priority.sort((x,y)=>y.opportunity_score-x.opportunity_score||y.total_revenue_cents-x.total_revenue_cents||y.total_leads-x.total_leads);
  const totals=priority.reduce((z,x)=>({spend_cents:z.spend_cents+metricNum(x.spend_cents),impressions:z.impressions+metricNum(x.impressions),clicks:z.clicks+metricNum(x.clicks),leads:z.leads+metricNum(x.total_leads),conversions:z.conversions+metricNum(x.total_conversions),revenue_cents:z.revenue_cents+metricNum(x.total_revenue_cents)}),{spend_cents:0,impressions:0,clicks:0,leads:0,conversions:0,revenue_cents:0});
  const organic=(social||[]).reduce((z,x)=>({impressions:z.impressions+metricNum(x.impressions),reach:z.reach+metricNum(x.reach),clicks:z.clicks+metricNum(x.clicks),engagements:z.engagements+metricNum(x.likes)+metricNum(x.comments)+metricNum(x.shares)+metricNum(x.saves),video_views:z.video_views+metricNum(x.video_views),leads:z.leads+metricNum(x.leads),revenue_cents:z.revenue_cents+metricNum(x.revenue_cents)}),{impressions:0,reach:0,clicks:0,engagements:0,video_views:0,leads:0,revenue_cents:0});
  return{period_days:days,generated_at:new Date().toISOString(),totals,organic_social:organic,priority,sources,runs}
}
function metricQ(field,v){return v===null||v===undefined||v===""?field+"=is.null":field+"=eq."+encodeURIComponent(String(v))}
async function metricsImport(a,sourceKey,rows){
  await requireGrowthAdmin(a);
  sourceKey=txt(sourceKey,80);
  const source=(await db("iz_metrics_sources?select=source_key&source_key=eq."+encodeURIComponent(sourceKey)+"&limit=1"))?.[0];
  if(!source)throw new Error("Unknown metrics source.");
  if(!Array.isArray(rows)||rows.length===0)throw new Error("rows array required.");
  if(rows.length>500)throw new Error("Maximum 500 rows per import.");
  const run=(await db("iz_metrics_sync_runs","POST",{source_key:sourceKey,run_kind:"import",status:"running",rows_received:rows.length}))[0];
  let up=0;
  try{
    for(const r of rows){
      const clean={metric_date:txt(r.metric_date,10),source_key:sourceKey,platform_slug:txt(r.platform_slug,80)||null,channel:txt(r.channel,60)||"unknown",account_external_id:txt(r.account_external_id,180)||null,campaign_external_id:txt(r.campaign_external_id,180)||null,campaign_name:txt(r.campaign_name,240)||null,country_code:txt(r.country_code,8)||null,currency:(txt(r.currency,3)||"ZAR").toUpperCase(),spend_cents:metricNum(r.spend_cents),impressions:metricNum(r.impressions),reach:metricNum(r.reach),clicks:metricNum(r.clicks),engagements:metricNum(r.engagements),video_views:metricNum(r.video_views),leads:metricNum(r.leads),conversions:metricNum(r.conversions),revenue_cents:metricNum(r.revenue_cents),raw:(r.raw&&typeof r.raw==="object")?r.raw:{}};
      if(!/^\d{4}-\d{2}-\d{2}$/.test(clean.metric_date))throw new Error("Each row needs metric_date YYYY-MM-DD.");
      const filter=[metricQ("metric_date",clean.metric_date),metricQ("source_key",sourceKey),metricQ("platform_slug",clean.platform_slug),metricQ("channel",clean.channel),metricQ("account_external_id",clean.account_external_id),metricQ("campaign_external_id",clean.campaign_external_id),metricQ("country_code",clean.country_code)].join("&");
      const ex=(await db("iz_metrics_daily?select=id&"+filter+"&limit=1"))?.[0];
      if(ex)await db("iz_metrics_daily?id=eq."+ex.id,"PATCH",{...clean,imported_at:new Date().toISOString()});
      else await db("iz_metrics_daily","POST",clean);
      up++;
    }
    await db("iz_metrics_sync_runs?id=eq."+run.id,"PATCH",{status:"succeeded",finished_at:new Date().toISOString(),rows_upserted:up});
    await db("iz_metrics_sources?source_key=eq."+encodeURIComponent(sourceKey),"PATCH",{status:"connected",last_sync_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()});
    return{run_id:run.id,rows_upserted:up}
  }catch(e){
    await db("iz_metrics_sync_runs?id=eq."+run.id,"PATCH",{status:"failed",finished_at:new Date().toISOString(),rows_upserted:up,error_message:txt(e?.message,1000)});
    await db("iz_metrics_sources?source_key=eq."+encodeURIComponent(sourceKey),"PATCH",{status:"error",last_sync_at:new Date().toISOString(),last_error:txt(e?.message,1000),updated_at:new Date().toISOString()});
    throw e
  }
}


function marketingScopes(provider){
 if(provider==="meta")return ["pages_show_list","pages_read_engagement","pages_manage_posts","instagram_basic","instagram_content_publish","instagram_manage_insights","ads_read"];
 if(provider==="google")return ["openid","email","profile","https://www.googleapis.com/auth/analytics.readonly","https://www.googleapis.com/auth/webmasters.readonly","https://www.googleapis.com/auth/youtube.readonly","https://www.googleapis.com/auth/business.manage","https://www.googleapis.com/auth/adwords"];
 throw new Error("Unsupported marketing provider.");
}
async function marketingRpc(name,body){return db("rpc/"+name,"POST",body)}
async function marketingApp(a,provider){return (await marketingRpc("iz_marketing_get_provider_app",{p_account_id:a.id,p_provider:provider}))?.[0]||null}
function marketingAuthUrl(provider,cfg,state){
 const scopes=(cfg.scopes||[]).join(" ");
 if(provider==="meta"){
   const u=new URL("https://www.facebook.com/dialog/oauth");
   u.search=new URLSearchParams({client_id:cfg.client_id,redirect_uri:cfg.redirect_uri,state,response_type:"code",scope:scopes}).toString();
   return u.toString();
 }
 if(provider==="google"){
   const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");
   u.search=new URLSearchParams({client_id:cfg.client_id,response_type:"code",redirect_uri:cfg.redirect_uri,state,scope:scopes,access_type:"offline",include_granted_scopes:"true",prompt:"consent"}).toString();
   return u.toString();
 }
 throw new Error("Unsupported marketing provider.");
}
function marketingPage(ok,title,msg){
 const back=base+"/functions/v1/izakhono-one-control?marketing=1";
 return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>body{font-family:system-ui;background:#071019;color:#f5fbff;margin:0}.c{max-width:680px;margin:70px auto;padding:30px;background:#0d1a25;border:1px solid #274153;border-radius:22px}.ok{color:#6cf3a5}.bad{color:#ff9ba4}a{display:inline-block;margin-top:18px;padding:11px 15px;border-radius:10px;background:#6cf3a5;color:#06130d;text-decoration:none;font-weight:900}</style></head><body><div class="c"><h1 class="'+(ok?"ok":"bad")+'">'+title+'</h1><p>'+msg+'</p><a href="'+back+'">Return to Marketing Connections</a></div></body></html>';
}
async function marketingOauthCallback(req){
 const u=new URL(req.url),state=txt(u.searchParams.get("state"),200),code=txt(u.searchParams.get("code"),4000),err=txt(u.searchParams.get("error"),500);
 if(!state)return new Response(marketingPage(false,"Connection failed","Missing OAuth state."),{status:400,headers:{"content-type":"text/html; charset=utf-8"}});
 const orows=await db("iz_marketing_oauth_requests?select=*&state=eq."+encodeURIComponent(state)+"&limit=1");
 const o=orows?.[0];
 if(!o||o.status!=="pending"||new Date(o.expires_at).getTime()<Date.now())return new Response(marketingPage(false,"Connection expired","Start the connection again from IZAKHONO ONE Control."),{status:400,headers:{"content-type":"text/html; charset=utf-8"}});
 if(err||!code){
   await db("iz_marketing_oauth_requests?id=eq."+o.id,"PATCH",{status:"failed",error:err||"authorization_code_missing"});
   await db("iz_marketing_connections?id=eq."+o.connection_id,"PATCH",{connector_status:"error",last_error:err||"authorization_code_missing",updated_at:new Date().toISOString()});
   return new Response(marketingPage(false,"Authorization cancelled","The provider did not authorize the connection."),{status:400,headers:{"content-type":"text/html; charset=utf-8"}});
 }
 try{
   const a=(await db("vf_one_accounts?select=id& id=eq."+encodeURIComponent(o.account_id)+"&limit=1".replace(" ","")))?.[0];
   if(!a)throw new Error("Owner account missing.");
   const cfg=await marketingApp(a,o.provider);if(!cfg)throw new Error("Provider app configuration missing.");
   let tokenRes,token:any={};
   if(o.provider==="meta"){
     const tu=new URL("https://graph.facebook.com/oauth/access_token");
     tu.search=new URLSearchParams({client_id:cfg.client_id,client_secret:cfg.client_secret,redirect_uri:cfg.redirect_uri,code}).toString();
     tokenRes=await fetch(tu);token=await tokenRes.json().catch(()=>({}));
   }else{
     const body=new URLSearchParams({client_id:cfg.client_id,client_secret:cfg.client_secret,code,grant_type:"authorization_code",redirect_uri:cfg.redirect_uri});
     tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
     token=await tokenRes.json().catch(()=>({}));
   }
   if(!tokenRes.ok||!token.access_token)throw new Error(token.error_description||token.error?.message||token.error||("Token exchange failed ("+tokenRes.status+")"));
   let providerUserId=null,accountName=null;
   try{
     if(o.provider==="meta"){
       const pr=await fetch("https://graph.facebook.com/me?fields=id,name&access_token="+encodeURIComponent(token.access_token));
       const pd=await pr.json();if(pr.ok){providerUserId=pd.id||null;accountName=pd.name||null}
     }else{
       const pr=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{authorization:"Bearer "+token.access_token}});
       const pd=await pr.json();if(pr.ok){providerUserId=pd.sub||null;accountName=pd.email||pd.name||null}
     }
   }catch{}
   const expires=token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000).toISOString():null;
   await marketingRpc("iz_marketing_store_token",{p_connection_id:o.connection_id,p_account_id:o.account_id,p_provider:o.provider,p_token_payload:JSON.stringify(token),p_expires_at:expires,p_scopes:cfg.scopes||[],p_provider_user_id:providerUserId,p_account_name:accountName,p_metadata:{connected_via:"izakhono-one-owner-oauth",connected_at:new Date().toISOString()}});
   await db("iz_marketing_oauth_requests?id=eq."+o.id,"PATCH",{status:"completed",error:null});
   const sources=o.provider==="meta"?["meta-organic","meta-ads"]:["google-ads","ga4","search-console","youtube","google-business-profile"];
   for(const sk of sources)await db("iz_metrics_sources?source_key=eq."+encodeURIComponent(sk),"PATCH",{status:"connected",credential_ref:"iz_marketing:"+o.provider,updated_at:new Date().toISOString(),last_error:null});
   return new Response(marketingPage(true,"Connected",o.provider.toUpperCase()+" authorization is securely connected to IZAKHONO ONE. The workers can now proceed to connector-specific verification and data sync."),{headers:{"content-type":"text/html; charset=utf-8"}});
 }catch(e){
   await db("iz_marketing_oauth_requests?id=eq."+o.id,"PATCH",{status:"failed",error:txt(e?.message,500)}).catch(()=>{});
   await db("iz_marketing_connections?id=eq."+o.connection_id,"PATCH",{connector_status:"error",last_error:txt(e?.message,500),updated_at:new Date().toISOString()}).catch(()=>{});
   return new Response(marketingPage(false,"Connection failed","The provider returned an error. Check the developer-app credentials, enabled APIs, approved scopes and registered redirect URI, then try again."),{status:400,headers:{"content-type":"text/html; charset=utf-8"}});
 }
}
async function marketingConnectionStatus(a){
 await requireGrowthAdmin(a);
 const [apps,connections]=await Promise.all([
   db("iz_marketing_provider_apps?select=provider,client_id,redirect_uri,scopes,updated_at&account_id=eq."+a.id+"&order=provider"),
   db("iz_marketing_connections?select=id,provider,connector_status,provider_user_id,account_name,permissions,expires_at,last_sync_at,last_error,updated_at&account_id=eq."+a.id+"&order=provider")
 ]);
 return {redirect_uri:base+"/functions/v1/izakhono-one-api?marketing_oauth_callback=1",apps:(apps||[]).map(x=>({...x,client_id_suffix:x.client_id.length>6?"••••"+x.client_id.slice(-6):"configured",client_id:undefined})),connections};
}
async function marketingProviderSave(a,b){
 await requireGrowthAdmin(a);
 const provider=txt(b.provider,20).toLowerCase();if(!["meta","google"].includes(provider))throw new Error("Unsupported provider.");
 const clientId=txt(b.client_id,500),clientSecret=txt(b.client_secret,2000);if(clientId.length<3||clientSecret.length<3)throw new Error("Client ID and Client Secret are required.");
 const redirectUri=base+"/functions/v1/izakhono-one-api?marketing_oauth_callback=1";
 const scopes=Array.isArray(b.scopes)&&b.scopes.length?b.scopes.map(x=>txt(x,300)).filter(Boolean):marketingScopes(provider);
 await marketingRpc("iz_marketing_store_provider_app",{p_account_id:a.id,p_provider:provider,p_client_id:clientId,p_client_secret:clientSecret,p_redirect_uri:redirectUri,p_scopes:scopes,p_metadata:{configured_from:"izakhono-one-control",updated_at:new Date().toISOString()}});
 return {provider,redirect_uri:redirectUri,scopes,secret_stored:"supabase_vault"};
}
async function marketingOauthStart(a,b){
 await requireGrowthAdmin(a);
 const provider=txt(b.provider,20).toLowerCase();if(!["meta","google"].includes(provider))throw new Error("Unsupported provider.");
 const cfg=await marketingApp(a,provider);if(!cfg)return {setup_required:true,provider};
 let con=(await db("iz_marketing_connections?select=*&account_id=eq."+a.id+"&provider=eq."+provider+"&limit=1"))?.[0];
 if(!con)con=(await db("iz_marketing_connections","POST",{account_id:a.id,provider,connector_status:"pending",metadata:{created_from:"izakhono-one-control"}}))[0];
 else await db("iz_marketing_connections?id=eq."+con.id,"PATCH",{connector_status:"pending",last_error:null,updated_at:new Date().toISOString()});
 const state=rand(48);
 await db("iz_marketing_oauth_requests","POST",{account_id:a.id,connection_id:con.id,provider,state,redirect_uri:cfg.redirect_uri,status:"pending"});
 return {setup_required:false,provider,authorization_url:marketingAuthUrl(provider,cfg,state),redirect_uri:cfg.redirect_uri};
}


async function nodeDb(path,method="GET",body,prefer){
 if(!base||!secret)return{ok:false,status:503,data:null,reason:"node_control_database_not_configured"};
 try{
  const r=await fetch(base+"/rest/v1/"+path,{method,headers:{apikey:secret,"Content-Type":"application/json","Accept":"application/json","Accept-Profile":"one",...(method==="GET"?{}:{"Content-Profile":"one"}),...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}
  return{ok:r.ok,status:r.status,data:d,reason:r.ok?null:"node_control_database_request_failed"};
 }catch{return{ok:false,status:502,data:null,reason:"node_control_database_unreachable"}}
}
function nodeBearer(req){
 const parts=(req.headers.get("authorization")||"").trim().split(/\s+/);
 return parts.length===2&&parts[0].toLowerCase()==="bearer"?parts[1]:"";
}
function nodeSafeEqual(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
async function nodeControlAuth(req){
 const token=nodeBearer(req);if(!token)return false;
 const hash=await sha(token),r=await nodeDb("node_control_credentials?select=token_hash&active=eq.true&revoked_at=is.null");
 return r.ok&&Array.isArray(r.data)&&r.data.some(x=>typeof x.token_hash==="string"&&nodeSafeEqual(x.token_hash,hash));
}
async function nodeAgentAuth(req,nodeId){
 const token=nodeBearer(req);if(!token)return false;
 const hash=await sha(token),r=await nodeDb("node_agent_credentials?select=token_hash&node_id=eq."+encodeURIComponent(nodeId)+"&active=eq.true&revoked_at=is.null&limit=1");
 return r.ok&&Array.isArray(r.data)&&!!r.data[0]&&nodeSafeEqual(r.data[0].token_hash,hash);
}
function nodeFortress(action,resource,sensitive=true){
 const principal={id:"izakhono-control",role:"owner",authenticated:true,verified:true};
 const scope=resource.startsWith("service:")?"service":resource==="platform"?"platform":"unknown";
 const scopes={service:["owner","admin","operator","member"],platform:["owner","admin"]};
 const perms={owner:["*"],admin:["read","manage","configure","execute"],operator:["read","execute"],member:["read"],guest:[]};
 if(!principal.id)return{decision:"deny",reason:"principal_required",gate:"FORTRESS"};
 if(!principal.authenticated)return{decision:"deny",reason:"authentication_required",gate:"FORTRESS"};
 if(!action)return{decision:"deny",reason:"action_required",gate:"FORTRESS"};
 if(!resource||scope==="unknown")return{decision:"deny",reason:"resource_not_authorized",gate:"FORTRESS"};
 if(!scopes[scope]?.includes(principal.role)&&principal.role!=="owner")return{decision:"deny",reason:"resource_scope_denied",gate:"FORTRESS"};
 if(sensitive&&!principal.verified)return{decision:"review",reason:"verification_required",gate:"FORTRESS"};
 const grants=perms[principal.role]||[],allowed=grants.includes("*")||grants.includes(action);
 return{decision:allowed?"allow":"deny",reason:allowed?"authorization_granted":"permission_denied",gate:"FORTRESS"};
}
async function nodeControlEvent(nodeId,eventType,payload={},correlationId=null){
 const r=await nodeDb("node_events","POST",{node_id:nodeId,event_type:eventType,correlation_id:correlationId,payload},"return=minimal");
 return r.ok;
}
async function nodeControlNode(nodeId){
 const r=await nodeDb("node_registry?select=*&node_id=eq."+encodeURIComponent(nodeId)+"&limit=1");
 if(!r.ok)return{ok:false,status:r.status,reason:r.reason};
 return{ok:true,node:Array.isArray(r.data)?r.data[0]||null:null};
}
async function nodeControlSave(node){
 const r=await nodeDb("node_registry?on_conflict=node_id","POST",node,"resolution=merge-duplicates,return=representation");
 if(!r.ok)return{ok:false,status:r.status,reason:r.reason};
 return{ok:true,node:Array.isArray(r.data)?r.data[0]||node:node};
}
async function nodeControl(req,b){
 const path=txt(b.path,240),method=txt(b.method,8).toUpperCase(),payload=b.payload&&typeof b.payload==="object"&&!Array.isArray(b.payload)?b.payload:{};
 const parts=path.split("/").filter(Boolean);
 if(parts.length===2&&parts[0]==="api"&&parts[1]==="nodes"&&method==="GET"){
  if(!(await nodeControlAuth(req)))return json({ok:false,error:"control_authentication_required"},401);
  const gate=nodeFortress("read","service:node-control:registry",false);
  if(gate.decision!=="allow")return json({ok:false,reason:gate.reason,gate},403);
  const r=await nodeDb("node_registry?select=*&state=eq.ready&health=eq.healthy&security_posture=eq.ready&order=node_id.asc");
  if(!r.ok)return json({ok:false,reason:r.reason},r.status);
  return json({ok:true,nodes:Array.isArray(r.data)?r.data:[]});
 }
 if(parts.length===3&&parts[0]==="api"&&parts[1]==="nodes"&&parts[2]==="register"&&method==="POST"){
  if(!(await nodeControlAuth(req)))return json({ok:false,error:"control_authentication_required"},401);
  const gate=nodeFortress("manage","service:node-control:registry",true);
  if(gate.decision!=="allow")return json({ok:false,reason:"fortress_"+gate.decision,gate},gate.decision==="review"?202:403);
  const nodeId=typeof payload.node_id==="string"?payload.node_id.trim():"";
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/.test(nodeId))return json({ok:false,reason:"invalid_node_id"},400);
  const existing=await nodeControlNode(nodeId);
  if(!existing.ok)return json({ok:false,reason:existing.reason},existing.status);
  if(existing.node)return json({ok:false,reason:"node_already_registered"},409);
  const now=new Date().toISOString(),nodeToken=rand(32);
  const node={node_id:nodeId,environment:["production","staging","development"].includes(String(payload.environment))?String(payload.environment):"production",capabilities:Array.isArray(payload.capabilities)?payload.capabilities.map(x=>txt(x,80)).filter(Boolean).slice(0,40):[],runtime_version:txt(payload.runtime_version,80)||"unknown",state:"registered",health:"unknown",security_posture:"unknown",last_seen_at:null,revision:null,registered_at:now,desired_workload:null,metadata:{registered_by:"izakhono-one-control"}};
  const saved=await nodeControlSave(node);
  if(!saved.ok)return json({ok:false,reason:saved.reason},saved.status);
  const credential=await nodeDb("node_agent_credentials","POST",{node_id:nodeId,token_hash:await sha(nodeToken),active:true},"return=minimal");
  if(!credential.ok){await nodeControlSave({...node,state:"offline"});return json({ok:false,reason:"node_credential_store_failed"},503);}
  const audit_event_recorded=await nodeControlEvent(nodeId,"node.registered",{environment:node.environment,capabilities:node.capabilities});
  return json({ok:true,node:saved.node,node_token:nodeToken,token_delivery:"one_time_only",audit_event_recorded,gate});
 }
 if(parts.length!==4||parts[0]!=="api"||parts[1]!=="nodes"||!["heartbeat","workload","deploy","drain"].includes(parts[3]))
  return json({ok:false,error:"node_route_not_found"},404);
 const nodeId=decodeURIComponent(parts[2]),action=parts[3];
 if(action==="heartbeat"&&method==="POST"){
  if(!(await nodeAgentAuth(req,nodeId)))return json({ok:false,error:"node_authentication_required"},401);
  const current=await nodeControlNode(nodeId);if(!current.ok)return json({ok:false,reason:current.reason},current.status);if(!current.node)return json({ok:false,reason:"node_not_registered"},404);
  const health=["healthy","degraded","unhealthy"].includes(String(payload.health))?String(payload.health):String(current.node.health||"unknown");
  const security=["ready","degraded","blocked"].includes(String(payload.security_posture))?String(payload.security_posture):String(current.node.security_posture||"unknown");
  const state=["draining","offline"].includes(String(current.node.state))?String(current.node.state):health==="healthy"&&security==="ready"?"ready":"registered";
  const revision=typeof payload.revision==="string"?payload.revision.slice(0,64):current.node.revision;
  const saved=await nodeControlSave({...current.node,health,security_posture:security,state,revision,last_seen_at:new Date().toISOString()});
  if(!saved.ok)return json({ok:false,reason:saved.reason},saved.status);
  const audit_event_recorded=await nodeControlEvent(nodeId,"node.heartbeat",{health,security_posture:security,state,revision:revision||null});
  return json({ok:true,node:saved.node,audit_event_recorded});
 }
 if(action==="workload"&&method==="POST"){
  if(!(await nodeControlAuth(req)))return json({ok:false,error:"control_authentication_required"},401);
  const gate=nodeFortress("execute","service:node-control:"+nodeId,true);
  if(gate.decision!=="allow")return json({ok:false,reason:"fortress_"+gate.decision,gate},gate.decision==="review"?202:403);
  const revision=typeof payload.revision==="string"?payload.revision.trim():"";
  if(!/^[a-f0-9]{7,64}$/i.test(revision))return json({ok:false,reason:"revision_must_be_a_commit_sha"},400);
  const current=await nodeControlNode(nodeId);if(!current.ok)return json({ok:false,reason:current.reason},current.status);if(!current.node)return json({ok:false,reason:"node_not_registered"},404);
  if(["draining","offline"].includes(String(current.node.state)))return json({ok:false,reason:"node_not_deployable"},409);
  if(current.node.health!=="healthy")return json({ok:false,reason:"node_not_healthy"},409);
  if(current.node.security_posture!=="ready")return json({ok:false,reason:"node_security_posture_not_ready"},409);
  const saved=await nodeControlSave({...current.node,desired_workload:{revision,authorized_at:new Date().toISOString()}});
  if(!saved.ok)return json({ok:false,reason:saved.reason},saved.status);
  const audit_event_recorded=await nodeControlEvent(nodeId,"workload.authorized",{revision,gate:gate.gate},typeof payload.correlation_id==="string"?payload.correlation_id:null);
  return json({ok:true,node:saved.node,deployment_verified:false,audit_event_recorded,gate});
 }
 if(action==="deploy"&&method==="POST"){
  if(!(await nodeAgentAuth(req,nodeId)))return json({ok:false,error:"node_authentication_required"},401);
  const revision=typeof payload.revision==="string"?payload.revision.trim():"";
  const current=await nodeControlNode(nodeId);if(!current.ok)return json({ok:false,reason:current.reason},current.status);if(!current.node)return json({ok:false,reason:"node_not_registered"},404);
  const desired=current.node.desired_workload||{};
  if(desired.revision!==revision)return json({ok:false,reason:"revision_not_authorized"},409);
  if(current.node.health!=="healthy"||current.node.security_posture!=="ready")return json({ok:false,reason:"node_not_ready"},409);
  const saved=await nodeControlSave({...current.node,revision,state:"ready",last_seen_at:new Date().toISOString(),desired_workload:{...desired,deployed_at:new Date().toISOString()}});
  if(!saved.ok)return json({ok:false,reason:saved.reason},saved.status);
  const audit_event_recorded=await nodeControlEvent(nodeId,"deployment.verified",{revision},typeof payload.correlation_id==="string"?payload.correlation_id:null);
  return json({ok:true,node:saved.node,deployment_verified:true,audit_event_recorded});
 }
 if(action==="drain"&&method==="POST"){
  if(!(await nodeControlAuth(req)))return json({ok:false,error:"control_authentication_required"},401);
  const gate=nodeFortress("manage","service:node-control:"+nodeId,true);
  if(gate.decision!=="allow")return json({ok:false,reason:"fortress_"+gate.decision,gate},gate.decision==="review"?202:403);
  const current=await nodeControlNode(nodeId);if(!current.ok)return json({ok:false,reason:current.reason},current.status);if(!current.node)return json({ok:false,reason:"node_not_registered"},404);
  const saved=await nodeControlSave({...current.node,state:"draining"});
  if(!saved.ok)return json({ok:false,reason:saved.reason},saved.status);
  const audit_event_recorded=await nodeControlEvent(nodeId,"node.draining",{},typeof payload.correlation_id==="string"?payload.correlation_id:null);
  return json({ok:true,node:saved.node,audit_event_recorded,gate});
 }
 return json({ok:false,error:"method_not_allowed"},405);
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method==="GET"){const u=new URL(req.url);if(u.searchParams.get("marketing_oauth_callback")==="1")return marketingOauthCallback(req);if(u.searchParams.get("node_control_health")==="1"){const probe=await nodeDb("node_registry?select=node_id&limit=0");const detail=probe.data&&typeof probe.data==="object"?{code:probe.data.code||null,message:probe.data.message||null}:null;return json({ok:probe.ok,service:"izakhono-one-api",node_control:probe.ok?"available":"unavailable",database_status:probe.status,database_error:detail},probe.ok?200:503);}return json({ok:true,service:"izakhono-one-api"});}
 if(req.method!=="POST")return json({error:"POST only"},405);
 if(!base||!secret)return json({error:"Server configuration unavailable."},500);
 try{
   const b=await req.json(),action=txt(b.action,40);
    if(action==="node_control")return await nodeControl(req,b);
   if(action==="setup"){
     const business=txt(b.business_name,120),email=txt(b.owner_email,180).toLowerCase(),country=txt(b.country_code,8)||"ZA",currency=txt(b.base_currency,3)||"ZAR";
     if(!business||!email.includes("@"))return json({error:"Business name and valid email required."},400);
     const token=rand(32),h=await sha(token),slug=slugify(business)+"-"+rand(4);
     const a=(await db("vf_one_accounts","POST",{access_token_hash:h,business_name:business,owner_email:email,public_slug:slug,plan:"launch",status:"active",country_code:country,base_currency:currency}))[0];
     try{await attachPartnerReferral(a,email,b.referral_code)}catch{}
     try{await ensureModules(h,business,email,currency)}catch(e){await db("vf_one_accounts?id=eq."+a.id,"DELETE");throw e}
     await db("vf_one_events","POST",{account_id:a.id,event_type:"workspace_created",module:"one",note:"Unified workspace created"});try{await ensureOnboarding(a)}catch{}
     return json({ok:true,access_token:token,account:{business_name:business,owner_email:email,plan:"launch",country_code:country,base_currency:currency}});
   }
   if(action==="adopt"){
     const token=txt(b.access_token,120);if(!token)return json({error:"Existing Forge owner token required."},400);
     const h=await sha(token);let a=await centralByHash(h);
     if(a)return json({ok:true,access_token:token,account:a,already_unified:true});
     const ident=await moduleIdentity(h);if(!ident)return json({error:"That token was not found in ProofForge, CashForge or MarginForge."},404);
     const business=ident.business_name,email=ident.owner_email,slug=slugify(business)+"-"+rand(4),country=txt(b.country_code,8)||"ZA",currency=txt(b.base_currency,3)||"ZAR";
     a=(await db("vf_one_accounts","POST",{access_token_hash:h,business_name:business,owner_email:email,public_slug:slug,plan:"launch",status:"active",country_code:country,base_currency:currency}))[0];
     await ensureModules(h,business,email,currency);
     await db("vf_one_events","POST",{account_id:a.id,event_type:"workspace_adopted",module:"one",note:"Existing Forge token unified"});try{await ensureOnboarding(a)}catch{}
     return json({ok:true,access_token:token,account:a,already_unified:false});
   }
   if(action==="dashboard"){
     const {a,h}=await owner(txt(b.access_token,120));return json({ok:true,...await dashboard(a,h)});
   }

   if(action==="onboarding_get"){
     const {a}=await owner(txt(b.access_token,120));const row=await ensureOnboarding(a);return json({ok:true,onboarding:row});
   }
   if(action==="onboarding_update"){
     const {a}=await owner(txt(b.access_token,120));let row=await ensureOnboarding(a),patch={};
     for(const k of onboardKeys)if(typeof b[k]==="boolean")patch[k]=b[k];
     const merged={...row,...patch},calc=onboardCalc(merged);patch={...patch,...calc,updated_at:new Date().toISOString()};
     row=(await db("vf_one_onboarding?account_id=eq."+a.id,"PATCH",patch))[0];
     await db("vf_one_events","POST",{account_id:a.id,event_type:"onboarding_updated",module:"one",note:"Onboarding "+row.completion_pct+"% complete"});
     return json({ok:true,onboarding:row});
   }
   if(action==="daily_brief"){
     const {a,h}=await owner(txt(b.access_token,120));return json({ok:true,...await dailyBrief(a,h)});
   }
   if(action==="growth_dashboard"){
     const {a}=await owner(txt(b.access_token,120));return json({ok:true,growth:await growthDashboard(a)});
   }
   if(action==="growth_update_lead"){
     const {a}=await owner(txt(b.access_token,120));await requireGrowthAdmin(a);
     const id=txt(b.lead_id,80),status=txt(b.status,30);
     if(!["new","contacted","qualified","trial","quoted","converted","lost","closed"].includes(status))return json({error:"Invalid growth lead status."},400);
     const found=await db("iz_portfolio_growth_leads?select=id& id=eq."+encodeURIComponent(id)+"&limit=1".replace(" ",""));
     if(!found?.[0])return json({error:"Growth lead not found."},404);
     const row=(await db("iz_portfolio_growth_leads?id=eq."+encodeURIComponent(id),"PATCH",{status,updated_at:new Date().toISOString()}))[0];
     return json({ok:true,lead:row});
   }
   if(action==="create_lead"){
     const {a}=await owner(txt(b.access_token,120));
     const name=txt(b.contact_name,120);if(!name)return json({error:"Contact name required."},400);
     const row=(await db("vf_one_leads","POST",{account_id:a.id,contact_name:name,business_name:txt(b.business_name,140)||null,email:txt(b.email,180)||null,phone:txt(b.phone,80)||null,need:txt(b.need,1000)||null,offer:txt(b.offer,1000)||null,estimated_value_cents:Math.max(0,Math.round(Number(b.estimated_value_cents)||0)),status:"new",next_action:txt(b.next_action,300)||"Make contact"}))[0];
     await db("vf_one_events","POST",{account_id:a.id,event_type:"lead_created",module:"sell",note:"Lead created: "+name});
     return json({ok:true,lead:row});
   }
   if(action==="billing_history"){
     const {a}=await owner(txt(b.access_token,120));
     const rows=await db("vf_one_payments?select=id,amount_cents,currency,status,provider,provider_reference,response_code,paid_at,created_at&one_account_id=eq."+a.id+"&source_type=eq.subscription&order=created_at.desc&limit=30");
     return json({ok:true,payments:(rows||[]).map(x=>({id:x.id,amount_cents:+x.amount_cents||0,currency:x.currency||"ZAR",status:x.status,provider:x.provider,provider_reference:x.provider_reference||null,response_code:x.response_code||null,paid_at:x.paid_at||null,created_at:x.created_at}))});
   }
   if(action==="update_lead"){
     const {a}=await owner(txt(b.access_token,120)),id=txt(b.lead_id,80),status=txt(b.status,30);
     if(!["new","contacted","qualified","quoted","won","lost"].includes(status))return json({error:"Invalid lead status."},400);
     const found=await db("vf_one_leads?select=id&account_id=eq."+a.id+"&id=eq."+encodeURIComponent(id)+"&limit=1");if(!found?.[0])return json({error:"Lead not found."},404);
     const row=(await db("vf_one_leads?id=eq."+encodeURIComponent(id),"PATCH",{status,next_action:txt(b.next_action,300)||null,updated_at:new Date().toISOString()}))[0];
     return json({ok:true,lead:row});
   }
   if(action==="marketing_connections"){const {a}=await owner(txt(b.access_token,120));return json({ok:true,marketing:await marketingConnectionStatus(a)});}
   if(action==="marketing_provider_save"){const {a}=await owner(txt(b.access_token,120));return json({ok:true,...await marketingProviderSave(a,b)});}
   if(action==="marketing_oauth_start"){const {a}=await owner(txt(b.access_token,120));const out=await marketingOauthStart(a,b);return json({ok:true,...out},out.setup_required?409:200);}
   if(action==="metrics_dashboard"){const {a}=await owner(txt(b.access_token,120));return json({ok:true,metrics:await metricsDashboard(a,b.days)});}
   if(action==="metrics_import"){const {a}=await owner(txt(b.access_token,120));return json({ok:true,...await metricsImport(a,b.source_key,b.rows)});}
   return json({error:"Unknown action."},400);
 }catch(e){return json({error:e?.message||"Request failed."},400)}
});