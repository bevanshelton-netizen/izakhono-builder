import postgres from "npm:postgres@3.4.3";
const DB_URL=Deno.env.get("SUPABASE_DB_URL")||"";
if(!DB_URL)throw new Error("SUPABASE_DB_URL_NOT_CONFIGURED");
const pg=postgres(DB_URL,{prepare:false,max:1,idle_timeout:20,connect_timeout:10});
const ALLOWED_TABLES=new Set(["iz_worker_jobs","iz_worker_outputs","iz_worker_events","iz_portfolio_campaign_queue","iz_portfolio_growth_platforms","iz_portfolio_growth_events","iz_portfolio_growth_leads","social_accounts","social_post_targets","social_evergreen","social_posts","social_brand_kits","social_events"]);
function ident(v:string){if(!/^[a-z_][a-z0-9_]*$/i.test(v))throw new Error("Invalid SQL identifier");return '"'+v+'"';}
function parseWhere(params:URLSearchParams,skip:Set<string>=new Set()){const clauses:string[]=[];const values:any[]=[];for(const [key,raw] of params.entries()){if(skip.has(key))continue;const m=raw.match(/^(eq|gte|lte|gt|lt|in)\.(.*)$/);if(!m)continue;const col=ident(key),op=m[1],v=m[2];if(op==="in"){const items=v.replace(/^\(/,"").replace(/\)$/,"").split(",");const marks=items.map(x=>{values.push(x);return "$"+values.length});clauses.push(col+" IN ("+marks.join(",")+")");}else if(op==="eq"&&v==="null"){clauses.push(col+" IS NULL");}else{const sqlOp=({eq:"=",gte:">=",lte:"<=",gt:">",lt:"<"} as any)[op];values.push(v);clauses.push(col+" "+sqlOp+" $"+values.length);}}return {sql:clauses.length?" WHERE "+clauses.join(" AND "):"",values};}
async function rest(path:string,method="GET",body?:any,prefer="return=representation"){const [table,query=""]=path.split("?");if(!ALLOWED_TABLES.has(table))throw new Error("Table not allowlisted: "+table);const params=new URLSearchParams(query);if(method==="GET"){const cols=(params.get("select")||"*").split(",").map(x=>x==="*"?"*":ident(x.trim())).join(",");const w=parseWhere(params,new Set(["select","order","limit"]));let order="";const ord=params.get("order");if(ord){order=" ORDER BY "+ord.split(",").map(x=>{const [col,dir="asc"]=x.split(".");if(!["asc","desc"].includes(dir.toLowerCase()))throw new Error("Invalid order");return ident(col)+" "+dir.toUpperCase()}).join(", ")}const lim=params.get("limit");const limit=lim&&/^\d+$/.test(lim)?" LIMIT "+Math.min(Number(lim),5000):"";return await pg.unsafe("SELECT "+cols+" FROM public."+ident(table)+w.sql+order+limit,w.values);}
if(method==="PATCH"){const entries=Object.entries(body||{});if(!entries.length)return [];const values:any[]=[];const set=entries.map(([k,v])=>{values.push(v);return ident(k)+"=$"+values.length}).join(",");const w=parseWhere(params,new Set());const offset=values.length;const where=w.sql.replace(/\$(\d+)/g,(_,n)=>"$"+(Number(n)+offset));values.push(...w.values);const returning=prefer.includes("return=representation")?" RETURNING *":"";return await pg.unsafe("UPDATE public."+ident(table)+" SET "+set+where+returning,values);}
if(method==="POST"){const rows=Array.isArray(body)?body:[body];if(!rows.length)return [];const keys=Object.keys(rows[0]||{});if(!keys.length)return [];for(const row of rows){if(Object.keys(row).join("|")!==keys.join("|"))throw new Error("Inconsistent insert columns");}const values:any[]=[];const tuples=rows.map(row=>"("+keys.map(k=>{values.push(row[k]);return "$"+values.length}).join(",")+")").join(",");const returning=prefer.includes("return=representation")?" RETURNING *":"";return await pg.unsafe("INSERT INTO public."+ident(table)+" ("+keys.map(ident).join(",")+") VALUES "+tuples+returning,values);}
throw new Error("Unsupported database method: "+method);}
const clean=(v:any,n=1200)=>String(v??"").trim().slice(0,n);
function channelCopy(channel:string,c:any){
 const base=[c.hook,c.body_copy,c.cta,c.landing_url].filter(Boolean);
 if(channel==="x")return base.join(" — ").slice(0,260);
 if(channel==="whatsapp")return [c.hook,c.body_copy,"👉 "+c.cta,c.landing_url].filter(Boolean).join("\n\n").slice(0,1600);
 if(channel==="linkedin")return [c.hook,c.body_copy,"Why it matters: "+c.objective,c.cta,c.landing_url].filter(Boolean).join("\n\n").slice(0,2200);
 if(channel==="instagram")return [c.hook,c.body_copy,c.cta,(c.hashtags||[]).join(" "),c.landing_url].filter(Boolean).join("\n\n").slice(0,2000);
 if(channel==="facebook")return [c.hook,c.body_copy,c.cta,c.landing_url].filter(Boolean).join("\n\n").slice(0,2500);
 if(channel==="youtube"||channel==="youtube_shorts")return [c.hook,c.body_copy,"CTA: "+c.cta,c.landing_url].filter(Boolean).join("\n\n").slice(0,2500);
 return base.join("\n\n").slice(0,1800);
}
async function workerOutput(job:any,outputType:string,content:any){
 await rest("iz_worker_outputs","POST",{job_id:job.id,platform_slug:job.platform_slug||null,campaign_key:job.campaign_key||null,worker_key:job.worker_key,output_type:outputType,content,status:"ready"},"return=minimal");
}
async function workerEvent(job:any,eventType:string,detail:any={}){
 await rest("iz_worker_events","POST",{job_id:job.id,worker_key:job.worker_key,event_type:eventType,detail},"return=minimal");
}
async function campaignFor(job:any){
 if(!job.campaign_key)return null;
 return (await rest("iz_portfolio_campaign_queue?select=*&campaign_key=eq."+encodeURIComponent(job.campaign_key)+"&limit=1"))?.[0]||null;
}
async function platformFor(slug:string){
 if(!slug)return null;
 return (await rest("iz_portfolio_growth_platforms?select=*&slug=eq."+encodeURIComponent(slug)+"&limit=1"))?.[0]||null;
}
async function executeWorkerJob(job:any){
 const c=await campaignFor(job),p=await platformFor(job.platform_slug);
 if(job.worker_key==="supercool"){
   if(!c)throw new Error("SUPERCOOL requires a campaign_key.");
   const chans=Array.isArray(c.recommended_channels)?c.recommended_channels:["facebook","instagram","whatsapp"];
   const variants:any={};for(const ch of chans)variants[ch]=channelCopy(ch,c);
   const content={engine:"SUPERCOOL",campaign_key:c.campaign_key,platform_slug:c.platform_slug,objective:c.objective,audience:c.audience,offer:{hook:c.hook,body:c.body_copy,cta:c.cta,landing_url:c.landing_url},channel_variants:variants,creative_direction:c.media_brief||"Product-led, mobile-first creative with clear CTA.",hashtags:c.hashtags||[],production_status:"creative_pack_ready",external_publish_authorized:false};
   await workerOutput(job,"campaign_creative_pack",content);return content;
 }
 if(job.worker_key==="metrics"){
   const since=new Date(Date.now()-30*86400000).toISOString();
   const ev=await rest("iz_portfolio_growth_events?select=event_name,amount_cents,occurred_at&platform_slug=eq."+encodeURIComponent(job.platform_slug)+"&occurred_at=gte."+encodeURIComponent(since)+"&limit=5000");
   const leads=await rest("iz_portfolio_growth_leads?select=id,status,lead_quality,created_at&platform_slug=eq."+encodeURIComponent(job.platform_slug)+"&created_at=gte."+encodeURIComponent(since)+"&limit=1000");
   const stats={page_views:0,cta_clicks:0,shares:0,payments:0,revenue_cents:0,leads:(leads||[]).length};
   for(const e of ev||[]){if(e.event_name==="page_view")stats.page_views++;if(e.event_name==="cta_click")stats.cta_clicks++;if(e.event_name==="share")stats.shares++;if(e.event_name==="payment_verified"){stats.payments++;stats.revenue_cents+=Number(e.amount_cents)||0}}
   const content={period_days:30,...stats,measurement_status:"baseline_captured"};await workerOutput(job,"metrics_baseline",content);return content;
 }
 if(job.worker_key==="growth-os"){
   const content={platform_slug:job.platform_slug,campaign_key:job.campaign_key,experiment:{hypothesis:"A clearer pain-led hook plus direct CTA will improve qualified conversion.",variant_a:c?.hook||"Current campaign hook",variant_b:(c?.hook?c.hook+" — act today.":"Direct problem/solution hook"),success_event:p?.conversion_event||"conversion",decision_rule:"Keep the variant that produces more verified conversion events; do not optimize on impressions alone."},next_action:"Run organic/tracked distribution first; add paid spend only after approval and baseline conversion evidence."};
   await workerOutput(job,"growth_experiment",content);return content;
 }
 if(job.worker_key==="social-command"){
   const accounts=await rest("social_accounts?select=id,platform,connector_status&limit=100");
   const content={campaign_key:job.campaign_key,recommended_channels:c?.recommended_channels||[],connected_accounts:(accounts||[]).filter((x:any)=>x.connector_status==="connected").map((x:any)=>x.platform),distribution_status:(accounts||[]).some((x:any)=>x.connector_status==="connected")?"connected_channels_available":"external_auth_required",owned_distribution:["owned_network","tracked_link","website","email_when_authorized"],paid_media_spend_authorized:false};
   await workerOutput(job,"distribution_plan",content);return content;
 }
 if(job.worker_key==="revenue-crm"){
   const leads=await rest("iz_portfolio_growth_leads?select=id,contact_name,business_name,email,phone,intent,status,lead_quality,created_at&platform_slug=eq."+encodeURIComponent(job.platform_slug)+"&status=in.(new,contacted,qualified,trial,quoted)&order=created_at.asc&limit=200");
   const actions=(leads||[]).map((l:any)=>({lead_id:l.id,contact_name:l.contact_name,business_name:l.business_name,email:l.email,phone:l.phone,status:l.status,lead_quality:l.lead_quality,next_action:l.status==="new"?"Make first contact and confirm need":l.status==="contacted"?"Qualify urgency and offer fit":l.status==="qualified"?"Present the direct offer and tracked checkout":"Follow up toward verified conversion"}));
   const content={open_leads:actions.length,actions,sending_status:"plan_only_no_external_message_sent"};await workerOutput(job,"crm_followup_batch",content);return content;
 }
 if(job.worker_key==="builder"){
   const content={landing_url:c?.landing_url||p?.campaign_url||p?.public_url||null,audit:{offer_visible:!!c?.body_copy,cta_visible:!!c?.cta,tracked_url:/utm_/i.test(c?.landing_url||""),price_known:!!p?.starting_price_cents,conversion_event:p?.conversion_event||null},required:["single primary CTA","mobile-first load","trust/legal/payment boundaries","conversion event tracking"],status:"conversion_surface_handoff_ready"};
   await workerOutput(job,"landing_conversion_handoff",content);return content;
 }
 if(job.worker_key==="shorts-factory"){
   const content={campaign_key:job.campaign_key,formats:[{seconds:15,beats:[{t:"0-3",scene:"Pain / opportunity hook",voice:c?.hook||""},{t:"3-10",scene:"Offer proof and value",voice:clean(c?.body_copy,240)},{t:"10-15",scene:"CTA + URL",voice:c?.cta||""}]},{seconds:30,beats:[{t:"0-5",scene:"Pattern interrupt",voice:c?.hook||""},{t:"5-20",scene:"Explain problem and offer",voice:clean(c?.body_copy,500)},{t:"20-27",scene:"Who it is for",voice:c?.audience||""},{t:"27-30",scene:"CTA",voice:c?.cta||""}]}],render_target:"IZAKHONO owned renderer / FFmpeg",media_brief:c?.media_brief||null,status:"render_manifest_ready"};
   await workerOutput(job,"shorts_render_manifest",content);return content;
 }
 if(job.worker_key==="command"){
   const content={queue_policy:"unlimited_queue",retry_policy:"up to "+job.max_attempts+" attempts",platform_slug:job.platform_slug,campaign_key:job.campaign_key,status:"orchestration_recorded"};
   await workerOutput(job,"command_orchestration",content);return content;
 }
 const content={worker_key:job.worker_key,role:"support_guardrail",platform_slug:job.platform_slug,campaign_key:job.campaign_key,marketing_spend_authorized:false,note:"Supporting guardian remains active on its existing schedule; no autonomous paid-spend or external-account action is authorized."};
 await workerOutput(job,"support_guardrail",content);return content;
}
async function processIzWorkerJobs(){
 const now=new Date().toISOString();
 const jobs=await rest("iz_worker_jobs?status=eq.queued&not_before=lte."+encodeURIComponent(now)+"&select=*&order=priority.desc,created_at.asc&limit=5");
 let completed=0,failed=0;
 for(const job of jobs||[]){
   try{
     const attempts=Number(job.attempts||0)+1;
     const claimed=await rest("iz_worker_jobs?id=eq."+job.id+"&status=eq.queued","PATCH",{status:"running",attempts,claimed_at:now,updated_at:now},"return=representation");if(!claimed?.length)continue;
     await workerEvent(job,"started",{attempt:attempts});
     const result=await executeWorkerJob(job);
     await rest("iz_worker_jobs?id=eq."+job.id,"PATCH",{status:"completed",result,completed_at:new Date().toISOString(),updated_at:new Date().toISOString(),error_message:null},"return=minimal");
     await workerEvent(job,"completed",{output:true});completed++;
   }catch(e){
     const attempts=Number(job.attempts||0)+1,max=Number(job.max_attempts||3);
     const terminal=attempts>=max;
     await rest("iz_worker_jobs?id=eq."+job.id,"PATCH",{status:terminal?"failed":"queued",not_before:new Date(Date.now()+Math.min(30,attempts*5)*60000).toISOString(),updated_at:new Date().toISOString(),error_message:clean(e?.message||e,1000)},"return=minimal").catch(()=>{});
     await workerEvent(job,terminal?"failed":"retry_scheduled",{error:clean(e?.message||e,1000),attempt:attempts}).catch(()=>{});failed++;
   }
 }
 return {worker_jobs_seen:(jobs||[]).length,worker_jobs_completed:completed,worker_jobs_failed_or_retried:failed};
}

function variant(platform:string,master:string,brand:string,cta:string){
 const hook=platform==="linkedin"?"Building visibility takes consistent execution.":platform==="tiktok"?"STOP SCROLLING — this is worth seeing.":platform==="instagram"?"🚀 Show up. Stay visible. Grow.":platform==="facebook"?"Your next customer may already be online looking for you.":"";
 let copy=[hook,master,cta,brand].filter(Boolean).join("\n\n");
 const max=platform==="x"?260:1200; if(copy.length>max)copy=copy.slice(0,max-1)+"…"; return copy;
}
async function authorizeWorker(req:Request){const supplied=req.headers.get("x-izakhono-worker-token")||"";if(!supplied)return false;const rows=await pg.unsafe("SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name=$1 LIMIT 1",["izakhono_worker_trigger"]);return rows[0]?.decrypted_secret===supplied;}
Deno.serve(async(req:Request)=>{
 const authorized=await authorizeWorker(req).catch(()=>false);
 if(!authorized)return new Response(JSON.stringify({error:"UNAUTHORIZED"}),{status:401,headers:{"content-type":"application/json"}});
 try{
  const now=new Date();const iso=now.toISOString();
  const due=await rest("social_post_targets?status=eq.queued&scheduled_for=lte."+encodeURIComponent(iso)+"&select=*&order=scheduled_for.asc&limit=200");
  let ready=0;
  for(const t of due||[]){
   await rest("social_post_targets?id=eq."+t.id,"PATCH",{status:"ready_for_manual",attempts:Number(t.attempts||0)+1},"return=minimal");
   await rest("social_events","POST",{owner_id:t.owner_id,workspace_id:t.workspace_id,event_type:"post_due",entity_type:"social_post_target",entity_id:t.id,details:{platform:t.platform,scheduled_for:t.scheduled_for}},"return=minimal");
   ready++;
  }
  const evergreen=await rest("social_evergreen?active=eq.true&next_recycle_at=lte."+encodeURIComponent(iso)+"&select=*&order=next_recycle_at.asc&limit=50");
  let recycled=0;
  for(const e of evergreen||[]){
   const postRows=await rest("social_posts","POST",{owner_id:e.owner_id,workspace_id:e.workspace_id,brand_id:e.brand_id,title:e.title+" · recycled",master_copy:e.master_copy,content_type:"post",approval_status:"approved",status:"scheduled"});
   const post=postRows?.[0];if(!post)continue;
   const bs=await rest("social_brand_kits?id=eq."+e.brand_id+"&select=name");const brand=bs?.[0]?.name||"IZAKHONO";
   const when=new Date(now.getTime()+5*60000).toISOString();
   const targets=(e.platforms||["facebook","instagram","linkedin"]).map((platform:string)=>({owner_id:e.owner_id,workspace_id:e.workspace_id,post_id:post.id,platform,platform_copy:variant(platform,e.master_copy,brand,e.cta||""),hashtags:["IZAKHONO","AfricanBusiness"],scheduled_for:when,status:"queued"}));
   await rest("social_post_targets","POST",targets,"return=minimal");
   const next=new Date(now.getTime()+Number(e.recycle_every_days||30)*86400000).toISOString();
   await rest("social_evergreen?id=eq."+e.id,"PATCH",{last_recycled_at:iso,next_recycle_at:next,times_recycled:Number(e.times_recycled||0)+1},"return=minimal");
   await rest("social_events","POST",{owner_id:e.owner_id,workspace_id:e.workspace_id,event_type:"evergreen_recycled",entity_type:"social_evergreen",entity_id:e.id,details:{post_id:post.id,next_recycle_at:next}},"return=minimal");
   recycled++;
  }
  const commandQueue=await processIzWorkerJobs();
  return new Response(JSON.stringify({ok:true,processed_due:(due||[]).length,ready_for_manual:ready,evergreen_recycled:recycled,...commandQueue,at:iso}),{headers:{"content-type":"application/json"}});
 }catch(e){return new Response(JSON.stringify({error:"Worker failure",details:String(e)}),{status:500,headers:{"content-type":"application/json"}})}
});