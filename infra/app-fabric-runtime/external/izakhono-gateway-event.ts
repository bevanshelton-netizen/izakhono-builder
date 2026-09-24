const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OWNED_FABRIC_URL="https://fabric.izakhonoafrica.co.za/api/fabric/intake";
const BRIDGE_ORIGIN="https://bridge.izakhonoafrica.co.za";

const allowedPlatforms=new Set(["gateway","social-command","webstart","kora","faisready","matric-rewrite","command-center","containers","chancellor","allegro","yenzanow"]);
const allowedEvents=new Set(["gateway_view","platform_open","platform_share","revenue_cta"]);

const fabricPlatforms:Record<string,{entity_id:string;events:Record<string,string>;origins?:string[];vercelPrefixes?:string[]}>={
  "izakhono-clothing":{entity_id:"izakhono-africa",events:{"lead.created":"New enquiry","quote.requested":"New enquiry"},origins:["https://izakhonoafrica.co.za","https://www.izakhonoafrica.co.za","https://izakhono-online.com","https://www.izakhono-online.com"]},
  "kora":{entity_id:"izakhono-africa",events:{"lead.created":"New"},origins:["https://kora-network.vercel.app"],vercelPrefixes:["kora-network"]},
  "kora-cinema":{entity_id:"izakhono-africa",events:{"lead.created":"New"}},
  "kora-gospel-tv":{entity_id:"izakhono-africa",events:{"lead.created":"New"}},
  "kora-kids":{entity_id:"izakhono-africa",events:{"lead.created":"New"}},
  "allegro-vibez":{entity_id:"izakhono-africa",events:{"lead.created":"New"},origins:["https://allegro-vibez.vercel.app"],vercelPrefixes:["allegro-vibez"]},
  "allegro-radio":{entity_id:"izakhono-africa",events:{"lead.created":"New"},origins:["https://allegro-vibez.vercel.app"]},
  "edu-build":{entity_id:"edu-build-shelton",events:{"lead.created":"Enquiry"},origins:["https://edubuildshelton.org.za","https://www.edubuildshelton.org.za"]},
  "ecd360":{entity_id:"edu-build-shelton",events:{"lead.created":"Enquiry"},origins:["https://edubuildshelton.org.za","https://www.edubuildshelton.org.za"]},
  "faisready":{entity_id:"izakhono-africa",events:{"lead.created":"Lead","checkout.started":"Checkout started"},origins:["https://faisready.co.za","https://www.faisready.co.za","https://faisready-revenue.vercel.app"],vercelPrefixes:["faisready-revenue"]},
  "doxa-sure":{entity_id:"izakhono-africa",events:{"lead.created":"New"},origins:["https://doxahosting.co.za","https://www.doxahosting.co.za","https://bevanshelton-netizen.github.io"]},
  "auto-ai":{entity_id:"izakhono-africa",events:{"lead.created":"Lead","checkout.started":"Quote requested"},origins:["https://auto-ai.vercel.app","https://auto-ai-eosin.vercel.app"],vercelPrefixes:["auto","auto-ai"]},
  "learner-driver-sa":{entity_id:"izakhono-africa",events:{"lead.created":"Lead"},origins:["https://learner-driver-sa-bevan2.vercel.app"],vercelPrefixes:["learner-driver-sa"]},
  "worknow":{entity_id:"izakhono-africa",events:{"lead.created":"Prospect"},origins:["https://worknow-sa.vercel.app"],vercelPrefixes:["worknow","worknow-sa"]},
  "memory-mania":{entity_id:"izakhono-africa",events:{"lead.created":"Lead"}},
  "music-school":{entity_id:"izakhono-africa",events:{"lead.created":"Enquiry"}},
  "recording-studio":{entity_id:"izakhono-africa",events:{"lead.created":"Enquiry"}},
  "supercool":{entity_id:"izakhono-africa",events:{"lead.created":"Lead"}},
  "zeely-style":{entity_id:"izakhono-africa",events:{"lead.created":"Lead"}},
  "the-chancellor":{entity_id:"izakhono-africa",events:{"lead.created":"Lead"},origins:["https://the-chancellor.vercel.app","https://the-chancellor-1eiq.vercel.app"],vercelPrefixes:["the-chancellor"]},
  "fortress":{entity_id:"izakhono-africa",events:{"lead.created":"Target account"}},
  "izakhono-code":{entity_id:"izakhono-africa",events:{"lead.created":"Lead"}},
  "izakhono-work":{entity_id:"izakhono-africa",events:{"lead.created":"Lead"}},
  "izakhono-cloud":{entity_id:"izakhono-africa",events:{"lead.created":"Lead"}},
  "izakhono-send":{entity_id:"izakhono-africa",events:{"lead.created":"Lead"}}
};

const exactFabricOrigins=new Set(Object.values(fabricPlatforms).flatMap(p=>p.origins||[]));

function clean(v:unknown,max=120){return String(v??"").trim().slice(0,max)}
function refHost(value:string){try{return value?new URL(value).hostname.slice(0,180):""}catch{return ""}}
function firstPartyOrigin(origin:string){
  try{
    const host=new URL(origin).hostname.toLowerCase();
    return host==="izakhonoafrica.co.za"||host.endsWith(".izakhonoafrica.co.za")||
      host==="edubuildshelton.org.za"||host.endsWith(".edubuildshelton.org.za");
  }catch{return false}
}
function platformOriginAllowed(origin:string,platformId?:string){
  if(firstPartyOrigin(origin)) return true;
  if(exactFabricOrigins.has(origin)) return true;
  try{
    const host=new URL(origin).hostname.toLowerCase();
    if(!host.endsWith("-bevan2.vercel.app")) return false;
    if(!platformId){
      return Object.values(fabricPlatforms).some(cfg=>(cfg.vercelPrefixes||[]).some(prefix=>host.startsWith(prefix.toLowerCase()+"-")));
    }
    const cfg=fabricPlatforms[platformId];
    return (cfg?.vercelPrefixes||[]).some(prefix=>host.startsWith(prefix.toLowerCase()+"-"));
  }catch{return false}
}
function headers(origin:string|null){
  let allowedOrigin="https://yfawrenhudjomhnglfhq.supabase.co";
  if(origin&&(origin.endsWith(".supabase.co")||platformOriginAllowed(origin))) allowedOrigin=origin;
  return {
    "content-type":"application/json",
    "access-control-allow-origin":allowedOrigin,
    "access-control-allow-methods":"GET, POST, OPTIONS",
    "access-control-allow-headers":"content-type",
    "vary":"Origin","cache-control":"no-store","x-content-type-options":"nosniff"
  };
}
function serviceHeaders(extra:Record<string,string>={}){
  return {apikey:SERVICE,authorization:"Bearer "+SERVICE,"content-type":"application/json",...extra};
}
async function rest(path:string,init:RequestInit={}){
  const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...init,headers:{...serviceHeaders(),...(init.headers||{})}});
  const t=await r.text();
  if(!r.ok) throw new Error("Persistence failed: "+r.status+" "+t.slice(0,180));
  return t?JSON.parse(t):null;
}
function normalizeFabric(body:any,origin:string){
  const platformId=clean(body?.platform_id,80);
  const platform=fabricPlatforms[platformId];
  if(!platform) throw Object.assign(new Error("Platform is not enabled on the external bridge"),{status:404});
  if(!platformOriginAllowed(origin,platformId)) throw Object.assign(new Error("Origin is not approved for this platform"),{status:403});
  const eventType=clean(body?.event_type,100);
  if(eventType==="payment.confirmed") throw Object.assign(new Error("Payment confirmation is not accepted on public intake"),{status:403});
  const stage=platform.events[eventType];
  if(!stage) throw Object.assign(new Error("Event type is not approved for public bridge intake"),{status:403});
  const subjectRef=clean(body?.subject_ref||body?.external_ref||body?.event_id,180);
  if(!subjectRef) throw Object.assign(new Error("subject_ref is required"),{status:400});
  const c=body?.contact&&typeof body.contact==="object"?body.contact:{};
  const o=body?.opportunity&&typeof body.opportunity==="object"?body.opportunity:{};
  const contact={
    name:clean(c.name,200),email:clean(c.email,320).toLowerCase(),phone:clean(c.phone,80),
    company:clean(c.company,200),role:clean(c.role,120),source:clean(c.source||body?.source||"external-bridge",120)
  };
  if(!contact.name&&!contact.email&&!contact.phone&&!contact.company) throw Object.assign(new Error("Contact is required"),{status:400});
  const value=Number(o.value||0);
  const opportunity={
    title:clean(o.title||platformId+" opportunity",240),value:Number.isFinite(value)?value:0,
    currency:clean(o.currency||"ZAR",8).toUpperCase(),stage,
    source:clean(o.source||body?.source||"external-bridge",120),
    external_ref:platformId+":"+subjectRef,next_action:clean(o.next_action,500),next_action_due:clean(o.next_action_due,40)
  };
  return {
    entity_id:platform.entity_id,platform_id:platformId,event_type:eventType,subject_ref:subjectRef,stage,
    dedupe_key:[platformId,eventType,subjectRef,stage].join("|"),contact,opportunity,
    note:clean(body?.note||eventType+" accepted by external resilience bridge",1000),source_origin:origin
  };
}
async function forwardOwned(e:any){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),4500);
  try{
    const r=await fetch(OWNED_FABRIC_URL,{
      method:"POST",headers:{"content-type":"application/json","origin":BRIDGE_ORIGIN},
      body:JSON.stringify({platform_id:e.platform_id,event_type:e.event_type,subject_ref:e.subject_ref,contact:e.contact,opportunity:e.opportunity,note:e.note}),
      signal:controller.signal
    });
    return {ok:[200,201,202].includes(r.status),status:r.status};
  }catch(error){return {ok:false,status:null,error:String(error?.message||error)}}
  finally{clearTimeout(timer)}
}
async function markForwarded(key:string){
  await rest("izakhono_fabric_external_events?dedupe_key=eq."+encodeURIComponent(key),{
    method:"PATCH",headers:{prefer:"return=minimal"},body:JSON.stringify({status:"forwarded_owned"})
  });
}
async function flushQueued(){
  const rows=await rest("izakhono_fabric_external_events?status=eq.queued_external&order=received_at.asc&limit=5&select=id,entity_id,platform_id,event_type,subject_ref,stage,dedupe_key,contact,opportunity,note,source_origin");
  let forwarded=0;
  for(const row of rows||[]){
    const result=await forwardOwned(row);
    if(result.ok){await markForwarded(row.dedupe_key);forwarded++}
  }
  return {attempted:(rows||[]).length,forwarded};
}
async function handleFabric(body:any,origin:string,h:Record<string,string>){
  const e=normalizeFabric(body,origin);
  await rest("izakhono_fabric_external_events?on_conflict=dedupe_key",{
    method:"POST",headers:{prefer:"resolution=ignore-duplicates,return=minimal"},
    body:JSON.stringify({
      entity_id:e.entity_id,platform_id:e.platform_id,event_type:e.event_type,subject_ref:e.subject_ref,stage:e.stage,
      dedupe_key:e.dedupe_key,contact:e.contact,opportunity:e.opportunity,note:e.note,source_origin:e.source_origin,status:"queued_external"
    })
  });
  await rest("izakhono_fabric_external_opportunities?on_conflict=entity_id,platform_id,external_ref",{
    method:"POST",headers:{prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({
      entity_id:e.entity_id,platform_id:e.platform_id,external_ref:e.opportunity.external_ref,title:e.opportunity.title,
      stage:e.stage,value:e.opportunity.value,currency:e.opportunity.currency,contact:e.contact,last_event_type:e.event_type,
      source_origin:e.source_origin,updated_at:new Date().toISOString()
    })
  });
  const forward=await forwardOwned(e);
  if(forward.ok) await markForwarded(e.dedupe_key);
  const backlog=await flushQueued();
  return new Response(JSON.stringify({
    ok:true,accepted:true,delivery:forward.ok?"owned-forwarded":"external-resilience",
    platform_id:e.platform_id,subject_ref:e.subject_ref,stage:e.stage,owned_forward_status:forward.status,backlog_flush:backlog
  }),{status:forward.ok?201:202,headers:h});
}

Deno.serve(async(req)=>{
  const origin=req.headers.get("origin");
  const h=headers(origin);
  if(req.method==="GET") return new Response(JSON.stringify({
    ok:true,service:"izakhono-gateway-event",fabric_bridge:true,mode:"hybrid-external-resilience",
    owned_target:"fabric.izakhonoafrica.co.za",payment_confirmation:false,
    public_platform_count:Object.keys(fabricPlatforms).length
  }),{status:200,headers:h});
  if(req.method==="OPTIONS"){
    if(origin&&!(origin.endsWith(".supabase.co")||platformOriginAllowed(origin))) return new Response(JSON.stringify({error:"Origin not allowed"}),{status:403,headers:h});
    return new Response("ok",{headers:h});
  }
  if(req.method!=="POST") return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:h});
  try{
    const body=await req.json();
    const eventType=clean(body?.event_type,100);
    if(body?.fabric_bridge===true||["lead.created","checkout.started","quote.requested","payment.confirmed"].includes(eventType)){
      return await handleFabric(body,origin||"",h);
    }
    const platform=clean(body?.platform_slug,80)||"gateway";
    if(!allowedEvents.has(eventType)||!allowedPlatforms.has(platform)) return new Response(JSON.stringify({error:"Invalid event"}),{status:400,headers:h});
    const row={event_type:eventType,platform_slug:platform,referrer_host:refHost(clean(body?.referrer,1000))||null,
      utm_source:clean(body?.utm_source,120)||null,utm_medium:clean(body?.utm_medium,120)||null,utm_campaign:clean(body?.utm_campaign,160)||null};
    await rest("izakhono_gateway_events",{method:"POST",headers:{prefer:"return=minimal"},body:JSON.stringify(row)});
    return new Response(JSON.stringify({ok:true}),{status:201,headers:h});
  }catch(error){
    const status=Number(error?.status||400);
    console.error("izakhono-gateway-event",error);
    return new Response(JSON.stringify({error:status>=500?"Unable to record event":String(error?.message||"Unable to record event")}),{status,headers:h});
  }
});