import { handlePocketPOS } from "./pocketpos.ts";
import { handleIdentity } from "./identity.ts";

const base = "https://yfawrenhudjomhnglfhq.supabase.co/functions/v1";
const eventEndpoint = base + "/izakhono-gateway-event";
const apps = {
  "revenue": { name: "IZAKHONO Revenue Sprint", url: "https://kora-network.vercel.app/izakhono-revenue/", host: "IZAKHONO Static Gateway", status: "live", desc:"Pay, book, reserve or start the offers that can convert now." },
  "social-command": { name: "IZAKHONO Social Command", url: base + "/social-command-live", host: "IZAKHONO / Supabase", status: "live", desc:"Plan, create and coordinate social media from one control layer." },
  "webstart": { name: "IZAKHONO WebStart", url: base + "/webstart-app", host: "IZAKHONO / Supabase", status: "live", desc:"Launch a professional business website quickly." },
  "kora": { name: "KORA", url: "https://kora-network.vercel.app", host: "Vercel gateway", status: "live", desc:"African-born music, entertainment, artists and live experiences." },
  "faisready": { name: "FAISReady", url: "https://faisready-revenue.vercel.app", host: "Vercel gateway", status: "live", desc:"Prepare for South African FAIS regulatory examinations." },
  "matric-rewrite": { name: "Matric Rewrite Prep Academy", url: "https://matric-rewrite-prep-academy.vercel.app", host: "Vercel gateway", status: "live", desc:"Focused support for learners rewriting matric subjects." },
  "command-center": { name: "IZAKHONO Command Center", url: "https://izakhono-command-center.vercel.app", host: "Vercel gateway", status: "live", desc:"Portfolio operations and launch control." },
  "containers": { name: "IZAKHONO Containers", url: "https://izakhono-containers-alpha.vercel.app", host: "Vercel gateway", status: "live", desc:"Portable infrastructure and application runtime layer." },
  "chancellor": { name: "The Chancellor", url: "https://the-chancellor.vercel.app", host: "Vercel gateway", status: "live", desc:"Business growth, guidance and opportunity desk." },
  "allegro": { name: "ALLEGRO VIBEZ", url: "https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/allegro-vibez-live", host: "IZAKHONO / Supabase public gateway", status: "live", desc:"Music, creators, studios, discovery and prosperity — public launch gateway." },
  "yenzanow": { name: "YenZaNow", url: "https://yenzanow.vercel.app", host: "Vercel gateway", status: "live", desc:"Book trusted local repair and home-service help." },
  "pocketpos": { name: "IZAKHONO PocketPOS", url: base + "/izakhono-gateway?app=pocketpos", host: "IZAKHONO external resilience", status: "pilot", desc:"Turn a phone into a sales, stock, customer and branch POS workstation." }
};

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function page(){
  const cards = Object.entries(apps).map(([slug,a]) => `
    <article class="card">
      <div class="topline"><strong>${esc(a.name)}</strong><span>${esc(String(a.status||"").toUpperCase())}</span></div>
      <p>${esc(a.desc)}</p>
      <div class="host">${esc(a.host)}</div>
      <div class="actions">
        <a class="open" href="?app=${encodeURIComponent(slug)}">Open platform →</a>
        <button type="button" class="share" data-slug="${esc(slug)}" data-name="${esc(a.name)}">Share</button>
      </div>
    </article>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>IZAKHONO Gateway</title>
  <meta name="description" content="One IZAKHONO gateway for live business, learning, creator and service platforms.">
  <style>
  :root{--n:#06131f;--p:#0d2031;--t:#0bb3bf;--g:#d4af37;--w:#f6fbfd;--m:#a9bac8}
  *{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:radial-gradient(circle at 20% 0,#163f4b 0,#07111e 38%,#050b13 100%);color:var(--w);min-height:100vh}
  header{padding:20px 5vw;border-bottom:1px solid #ffffff18;display:flex;justify-content:space-between;gap:16px;align-items:center}
  .brand{font-weight:950;letter-spacing:-.03em}.brand b{color:var(--t)}.badge{padding:7px 10px;border-radius:999px;background:#153b2a;color:#adffd0;font-size:.76rem;font-weight:900}
  main{max-width:1200px;margin:auto;padding:60px 5vw}.eyebrow{color:#7ae4ea;font-weight:900;letter-spacing:.12em;text-transform:uppercase;font-size:.78rem}
  h1{font-size:clamp(2.6rem,7vw,5.5rem);line-height:.92;letter-spacing:-.06em;margin:14px 0 18px}.lead{max-width:820px;color:var(--m);font-size:1.12rem;line-height:1.65}
  .note{margin:28px 0;padding:15px 17px;border:1px solid #d4af3744;background:#d4af3712;border-radius:13px;color:#f4ddb0}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:30px}.card{background:#ffffff0b;border:1px solid #ffffff18;border-radius:18px;padding:19px;transition:.15s}
  .card:hover{transform:translateY(-2px);border-color:#0bb3bf88;background:#ffffff10}.topline{display:flex;justify-content:space-between;gap:10px}.topline span{font-size:.68rem;background:#153b2a;color:#adffd0;padding:4px 7px;border-radius:999px;font-weight:900}
  .card p{color:var(--m);line-height:1.5;min-height:44px}.host{color:#71879a;font-size:.8rem}.actions{display:flex;gap:9px;margin-top:18px}.open,.share{border:0;border-radius:11px;padding:11px 13px;font:inherit;font-weight:900}
  .open{background:linear-gradient(135deg,#0bb3bf,#147b8a);color:white;text-decoration:none;flex:1}.share{background:#ffffff10;color:#e7f8fa;border:1px solid #ffffff1f;cursor:pointer}
  .share.done{color:#adffd0}.foot{margin-top:34px;color:#72889a;font-size:.83rem}
  @media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.grid{grid-template-columns:1fr}main{padding-top:40px}.badge{display:none}}
  </style></head><body>
  <header><div class="brand">IZAKHONO <b>GATEWAY</b></div><div class="badge">REVENUE SPRINT + 10 LIVE PLATFORMS</div></header>
  <main><div class="eyebrow">IZAKHONO AFRICA PLATFORM FLEET</div><h1>Sell first.<br>Then explore the fleet.</h1>
  <p class="lead">Start with the Revenue Sprint for live checkout, bookings and reservations. The full IZAKHONO portfolio remains available below while owner-node cutovers continue.</p>
  <div class="note"><strong>Launch rule:</strong> customer links stay stable here while upstream infrastructure can change behind the scenes. Payment, regulated-service and sensitive-data gates remain independent.</div>
  <div class="grid">${cards}</div><div class="foot">IZAKHONO AFRICA (PTY) LTD · Gateway-first launch mode · Privacy-safe traffic telemetry active.</div></main>
  <script>
  const endpoint=${JSON.stringify(eventEndpoint)};
  const q=new URLSearchParams(location.search);
  const campaign={utm_source:q.get('utm_source')||'',utm_medium:q.get('utm_medium')||'',utm_campaign:q.get('utm_campaign')||''};
  function event(event_type,platform_slug){
    fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event_type,platform_slug,referrer:document.referrer,...campaign}),keepalive:true}).catch(()=>{});
  }
  event('gateway_view','gateway');
  document.querySelectorAll('.share').forEach(btn=>btn.addEventListener('click',async()=>{
    const slug=btn.dataset.slug,name=btn.dataset.name;
    const url=new URL(location.href);url.search='';url.searchParams.set('app',slug);
    event('platform_share',slug);
    try{
      if(navigator.share) await navigator.share({title:name,text:'Open '+name+' on the IZAKHONO Gateway',url:url.toString()});
      else {await navigator.clipboard.writeText(url.toString());btn.textContent='Copied';btn.classList.add('done');setTimeout(()=>{btn.textContent='Share';btn.classList.remove('done')},1800)}
    }catch{}
  }));
  </script></body></html>`;
}

async function recordOpen(slug,u){
  try{
    await fetch(eventEndpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      event_type:"platform_open",
      platform_slug:slug,
      referrer:u.searchParams.get("ref")||"",
      utm_source:u.searchParams.get("utm_source")||"",
      utm_medium:u.searchParams.get("utm_medium")||"",
      utm_campaign:u.searchParams.get("utm_campaign")||""
    })});
  }catch{}
}

Deno.serve(async(req)=>{
  const u = new URL(req.url);
  const identityResponse = await handleIdentity(req,u);
  if(identityResponse) return identityResponse;
  const pocket = await handlePocketPOS(req,u);
  if(pocket) return pocket;
  if(u.searchParams.get("health")==="1"){
    return new Response(JSON.stringify({ok:true,service:"IZAKHONO Gateway",apps:Object.keys(apps),count:Object.keys(apps).length,mode:"temporary_gateway",telemetry:"privacy_safe"}),{headers:{"content-type":"application/json","cache-control":"no-store"}});
  }
  const slug=(u.searchParams.get("app")||"").toLowerCase().trim();
  if(!slug) return new Response(page(),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=60","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin"}});
  const app=apps[slug];
  if(!app) return new Response("Unknown IZAKHONO gateway route",{status:404,headers:{"content-type":"text/plain; charset=utf-8"}});
  await recordOpen(slug,u);
  const target=new URL(app.url);
  for(const [k,v] of u.searchParams){ if(k!=="app"&&k!=="ref") target.searchParams.append(k,v); }
  return Response.redirect(target.toString(),302);
});
