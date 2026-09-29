import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8096);
const DATA_DIR=process.env.GROWTH_DATA_DIR||path.join(__dirname,".data");
const LEADS_FILE=path.join(DATA_DIR,"leads.json");
const ADMIN_TOKEN=process.env.GROWTH_ADMIN_TOKEN||"";
const CRM_URL=(process.env.CRM_URL||"").replace(/\/$/,"");
const CRM_TOKEN=process.env.CRM_INGEST_TOKEN||"";
const ENTITY_ID=process.env.GROWTH_ENTITY_ID||"izakhono-africa";
const campaigns=JSON.parse(await fs.readFile(path.join(__dirname,"campaigns","wave1.json"),"utf8"));
await fs.mkdir(DATA_DIR,{recursive:true});
const rate=new Map();

const now=()=>new Date().toISOString();
const clean=(v,n=500)=>String(v??"").trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,n);
const uid=p=>p+"_"+crypto.randomBytes(8).toString("hex");
const esc=v=>String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s]));
function json(res,status,data){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});res.end(JSON.stringify(data))}
async function readBody(req){let s="";for await(const c of req){s+=c;if(Buffer.byteLength(s)>262144)throw Object.assign(new Error("payload too large"),{status:413})}if(!s)return{};try{return JSON.parse(s)}catch{throw Object.assign(new Error("invalid json"),{status:400})}}
async function readLeads(){try{const x=JSON.parse(await fs.readFile(LEADS_FILE,"utf8"));return Array.isArray(x)?x:[]}catch(e){if(e.code==="ENOENT")return[];throw e}}
async function writeLeads(x){const tmp=LEADS_FILE+".tmp";await fs.writeFile(tmp,JSON.stringify(x,null,2));await fs.rename(tmp,LEADS_FILE)}
function isAdmin(req){const raw=req.headers.authorization||"";return Boolean(ADMIN_TOKEN)&&raw===("Bearer "+ADMIN_TOKEN)}
function getCampaign(slug){return campaigns.campaigns.find(x=>x.slug===slug)}
function rateOk(req){const key=clean((req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0],80)||"unknown",t=Date.now(),windowMs=3600000;const xs=(rate.get(key)||[]).filter(x=>t-x<windowMs);if(xs.length>=10){rate.set(key,xs);return false}xs.push(t);rate.set(key,xs);return true}
function pack(input){const product=clean(input.product,120),audience=clean(input.audience,240),offer=clean(input.offer,500),cta=clean(input.cta||"Learn more",120);return{schema:"izakhono.marketing.package.v1",source:"IZAKHONO CREATE",generated_by:"IZAKHONO Growth Engine",campaign_name:product+" — Growth campaign",product,audience,offer,cta,channels:["WhatsApp","email","LinkedIn","organic social","portfolio cross-promotion"],spend_status:"NOT_AUTHORISED",compliance_status:"REQUIRES_PRODUCT_GATE",creative:{variants:[{channel:"WhatsApp",copy:product+": "+offer+" "+cta+"."},{channel:"Email",subject:product+" — "+cta,copy:"For "+audience+": "+offer+" Reply to discuss the next step."},{channel:"LinkedIn",copy:offer+" Built for "+audience+". "+cta+"."},{channel:"Short video",copy:"Problem. Offer. Proof. "+offer+" "+cta+"."}]},privacy:{behavioural_tracking:false,advertising_ids:false,tracking_cookies:false},created_at:now()}}
async function pushCRM(lead){
  if(!CRM_URL||!CRM_TOKEN)return{ok:false,reason:"CRM adapter not configured"};
  const payload={contact:{name:lead.name,email:lead.email,phone:lead.phone,company:lead.company,source:"IZAKHONO Growth Engine",tags:["growth-engine",lead.campaign].filter(Boolean)},deal:{external_ref:lead.id,title:(lead.company||lead.name||"Lead")+" — "+lead.campaign,source:"IZAKHONO Growth Engine",next_action:"Respond to qualified Growth Engine enquiry"},note:lead.message||"Growth Engine enquiry"};
  const r=await fetch(CRM_URL+"/api/intake",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+CRM_TOKEN,"X-Entity-ID":ENTITY_ID,"X-Platform-ID":lead.product||"izakhono-growth-engine"},body:JSON.stringify(payload)});
  return{ok:r.ok,status:r.status,result:await r.json().catch(()=>({}))};
}
function landing(c){
  const gated=c.mode!=="DIRECT_OUTREACH_READY";
  return \`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\${esc(c.display_name)}</title><style>body{font-family:Arial,sans-serif;background:#071421;color:#eef6fb;margin:0}main{max-width:860px;margin:auto;padding:60px 22px}.ey{color:#f0c45c;font-weight:800;letter-spacing:.14em}.card{background:#0e263b;border:1px solid #24516a;border-radius:20px;padding:28px}h1{font-size:clamp(2.4rem,8vw,5rem);line-height:.95}.cta{background:#f0c45c;color:#14202a;padding:12px 16px;border:0;border-radius:9px;font-weight:800}input,textarea{width:100%;box-sizing:border-box;margin:6px 0 14px;padding:12px;border-radius:8px;border:1px solid #31586e;background:#071522;color:white}.note{color:#adc2d0;font-size:.85rem}.warn{padding:10px;border-radius:9px;background:#392d16;color:#ffe8a9}</style></head><body><main><p class="ey">IZAKHONO AFRICA</p><h1>\${esc(c.display_name)}</h1><p>\${esc(c.offer)}</p>\${gated?'<p class="warn">Broad campaign distribution is held until the destination/customer journey passes verification. Direct enquiries are still accepted.</p>':""}<div class="card"><h2>\${esc(c.cta)}</h2><form id="lead"><input type="hidden" name="campaign" value="\${esc(c.slug)}"><label>Name<input name="name" required></label><label>Company<input name="company"></label><label>Email<input name="email" type="email"></label><label>Phone<input name="phone"></label><label>What do you need?<textarea name="message"></textarea></label><label style="display:none">Website<input name="website" tabindex="-1" autocomplete="off"></label><label><input style="width:auto" type="checkbox" name="consent" required> I agree to be contacted about this enquiry.</label><button class="cta">Send enquiry</button><p id="status" class="note"></p></form></div><p class="note">No tracking cookies or advertising IDs. Your enquiry is used to respond to this request.</p><script>document.getElementById("lead").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target),p=Object.fromEntries(f.entries());p.consent=f.get("consent")==="on";const r=await fetch("/api/public/lead",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(p)});const j=await r.json();document.getElementById("status").textContent=r.ok?"Thank you. Your enquiry has been received.":(j.error||"Unable to submit.");if(r.ok)e.target.reset()})</script></main></body></html>\`;
}
async function staticFile(url,res){const rel=url.pathname==="/"?"index.html":url.pathname.replace(/^\/+/,"");const root=path.resolve(__dirname,"public"),full=path.resolve(root,rel);if(!full.startsWith(root))return false;try{const data=await fs.readFile(full),ext=path.extname(full),type=ext===".html"?"text/html; charset=utf-8":ext===".css"?"text/css; charset=utf-8":ext===".js"?"text/javascript; charset=utf-8":"application/octet-stream";res.writeHead(200,{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","content-security-policy":"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"});res.end(data);return true}catch(e){if(e.code==="ENOENT")return false;throw e}}
export async function handler(req,res){
  try{
    const url=new URL(req.url,\`http://\${req.headers.host||"localhost"}\`);
    if(req.method==="GET"&&url.pathname==="/health")return json(res,200,{ok:true,service:"izakhono-growth-engine",version:"0.1.0",owned_first:true,crm_adapter:Boolean(CRM_URL&&CRM_TOKEN),public_live_verified:false});
    if(req.method==="GET"&&url.pathname==="/api/campaigns")return json(res,200,campaigns);
    if(req.method==="GET"&&url.pathname==="/api/dashboard"){const leads=await readLeads();return json(res,200,{campaigns:campaigns.campaigns.length,direct_outreach_ready:campaigns.campaigns.filter(x=>x.mode==="DIRECT_OUTREACH_READY").length,leads:leads.length,crm_pushed:leads.filter(x=>x.crm_status==="pushed").length})}
    if(req.method==="POST"&&url.pathname==="/api/campaigns/generate"){const x=await readBody(req);if(!clean(x.product)||!clean(x.audience)||!clean(x.offer))return json(res,400,{error:"product, audience and offer are required"});return json(res,201,pack(x))}
    if(req.method==="POST"&&url.pathname==="/api/public/lead"){if(!rateOk(req))return json(res,429,{error:"too many requests"});const x=await readBody(req);if(clean(x.website))return json(res,202,{ok:true});const campaign=getCampaign(clean(x.campaign,120)),email=clean(x.email,200),phone=clean(x.phone,80);if(!x.consent)return json(res,400,{error:"contact consent is required"});if(!email&&!phone)return json(res,400,{error:"email or phone is required"});const lead={id:uid("lead"),campaign:campaign?.slug||clean(x.campaign,120),product:campaign?.product||"izakhono-growth-engine",name:clean(x.name,160),company:clean(x.company,180),email,phone,message:clean(x.message,1500),consent:true,created_at:now(),crm_status:"queued"};const leads=await readLeads();leads.push(lead);await writeLeads(leads);if(CRM_URL&&CRM_TOKEN){const crm=await pushCRM(lead);if(crm.ok){lead.crm_status="pushed";lead.crm_pushed_at=now();await writeLeads(leads)}}return json(res,201,{ok:true,id:lead.id,crm_status:lead.crm_status})}
    if(req.method==="GET"&&url.pathname==="/api/leads"){if(!isAdmin(req))return json(res,401,{error:"unauthorized"});return json(res,200,{items:await readLeads()})}
    const m=url.pathname.match(/^\/api\/leads\/([^/]+)\/push-crm$/);if(req.method==="POST"&&m){if(!isAdmin(req))return json(res,401,{error:"unauthorized"});const leads=await readLeads(),lead=leads.find(x=>x.id===m[1]);if(!lead)return json(res,404,{error:"lead not found"});const crm=await pushCRM(lead);if(crm.ok){lead.crm_status="pushed";lead.crm_pushed_at=now();await writeLeads(leads)}return json(res,crm.ok?200:503,{ok:crm.ok,crm})}
    if(req.method==="GET"&&url.pathname.startsWith("/l/")){const c=getCampaign(decodeURIComponent(url.pathname.slice(3)));if(!c)return json(res,404,{error:"campaign not found"});res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","content-security-policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"});return res.end(landing(c))}
    if(req.method==="GET"&&!url.pathname.startsWith("/api/")&&await staticFile(url,res))return;
    return json(res,404,{error:"not found"});
  }catch(e){return json(res,e.status||500,{error:e.status?e.message:"internal error"})}
}
if(process.env.NODE_ENV!=="test")http.createServer(handler).listen(PORT,"0.0.0.0",()=>console.log(JSON.stringify({service:"izakhono-growth-engine",port:PORT,started_at:now()})));
