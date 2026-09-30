import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
process.env.NODE_ENV="test";
process.env.GROWTH_DATA_DIR="/tmp/izakhono-growth-"+process.pid;
const {handler}=await import("../server.mjs");
const server=http.createServer(handler);
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const base="http://127.0.0.1:"+server.address().port;

test("health and wave",async()=>{const h=await fetch(base+"/health").then(r=>r.json());assert.equal(h.ok,true);const c=await fetch(base+"/api/campaigns").then(r=>r.json());assert.ok(c.campaigns.length>=5);assert.ok(c.campaigns.some(x=>x.mode==="DIRECT_OUTREACH_READY"))});
test("controlled campaign pack",async()=>{const r=await fetch(base+"/api/campaigns/generate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({product:"IZAKHONO HOST",audience:"SMEs",offer:"Business website and hosting",cta:"Request setup"})});assert.equal(r.status,201);const x=await r.json();assert.equal(x.source,"IZAKHONO CREATE");assert.equal(x.spend_status,"NOT_AUTHORISED");assert.equal(x.privacy.behavioural_tracking,false)});
test("live product launch pack exposes verified destination without authorising spend",async()=>{const r=await fetch(base+"/api/campaigns/auto-ai-live/launch-pack");assert.equal(r.status,200);const x=await r.json();assert.equal(x.schema,"izakhono.live.launch.pack.v1");assert.equal(x.verified_public_destination,true);assert.match(x.destination_url,/auto-ai-eosin\.vercel\.app/);assert.equal(x.paid_media,false);assert.equal(x.spend_status,"NOT_AUTHORISED");assert.equal(x.privacy.behavioural_tracking,false)});
test("verified live campaign landing routes to the actual product",async()=>{const r=await fetch(base+"/l/worknow-live");assert.equal(r.status,200);const html=await r.text();assert.match(html,/OPEN LIVE PRODUCT/);assert.match(html,/worknow-sa\.vercel\.app/);assert.doesNotMatch(html,/Broad campaign distribution is held/)});
test("growth diagnostic produces a private prescription",async()=>{const r=await fetch(base+"/api/public/growth-diagnostic",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revenue_band:"50k_250k",goal:"automation_ai",urgency:"now_30_days",sales_process:"manual",digital_foundation:"active_site",buying_mode:"guided"})});assert.equal(r.status,200);const x=await r.json();assert.equal(x.schema,"izakhono.growth.diagnostic.v1");assert.equal(x.lane,"GROWTH");assert.equal(x.actions.length,3);assert.ok(x.recommended_products.includes("izakhono-flow"));assert.equal(x.privacy.behavioural_tracking,false)});
test("diagnostic lead capture requires consent",async()=>{const r=await fetch(base+"/api/public/growth-diagnostic/lead",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:"Test",phone:"27000000000",answers:{goal:"customers"}})});assert.equal(r.status,400)});
test("lead capture requires consent",async()=>{const r=await fetch(base+"/api/public/lead",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({campaign:"izakhono-host-business",name:"Test",email:"test@example.com"})});assert.equal(r.status,400)});
test.after(()=>new Promise(r=>server.close(r)));
