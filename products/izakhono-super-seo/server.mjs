import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8097);
const PUBLIC=path.join(__dirname,"public");
const now=()=>new Date().toISOString();
const clean=(v,n=500)=>String(v??"").trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,n);
const esc=v=>String(v??"").replace(/[&<>\"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s]));

const stop=new Set("the a an and or for to of in on with from your our how what why best top guide near south africa sa is are be by into vs versus 2026 2025".split(" "));
function words(s){return [...new Set(clean(s,5000).toLowerCase().replace(/[^a-z0-9 -]/g," ").split(/\s+/).filter(x=>x.length>2&&!stop.has(x)))];}
function slug(s){return clean(s,160).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function scoreKeyword(k,i){const intent=/price|cost|quote|supplier|buy|service|company|provider|course|training|hosting|email|repair/i.test(k)?"commercial":/how|what|guide|tips|requirements|learn/i.test(k)?"informational":"discovery";const longTail=k.split(" ").length>=3;return {keyword:k,intent,long_tail:longTail,difficulty:Math.min(95,25+i*4+(longTail?-8:8)),opportunity:Math.max(20,92-i*5+(longTail?12:0)),priority:Math.max(1,Math.round((92-i*5+(longTail?12:0))/10))};}
function clusterKeywords(seed){
  const base=[...new Set(seed.flatMap(words))];
  const phrases=[];
  for(const k of base){phrases.push(k,`${k} south africa`,`best ${k}`,`${k} price`,`${k} services`,`how to ${k}`);}
  return [...new Set(phrases)].filter(x=>x.split(" ").length<=7).slice(0,60).map(scoreKeyword);
}
function makePlan(keywords,domain){
  const chosen=keywords.slice().sort((a,b)=>b.opportunity-a.opportunity).slice(0,18);
  return chosen.map((x,i)=>({id:`seo-${i+1}`,title:`${x.keyword.replace(/\b\w/g,c=>c.toUpperCase())}: A Practical Guide`,keyword:x.keyword,intent:x.intent,word_count:x.intent==="commercial"?1300:1500,difficulty:x.difficulty,opportunity:x.opportunity,cta:x.intent==="commercial"?"Request a quote / start now":"Explore the related service or guide",target_url:`https://${domain}/insights/${slug(x.keyword)}`,internal_links:[`https://${domain}/`,...chosen.slice(Math.max(0,i-2),i).map(y=>`https://${domain}/insights/${slug(y.keyword)}`)]}));
}
function analyze(input){
  const domain=clean(input.domain,180).replace(/^https?:\/\//,"").replace(/\/.*/,"");
  const competitors=[...(Array.isArray(input.competitors)?input.competitors:[])].map(x=>clean(x,180).replace(/^https?:\/\//,"").replace(/\/.*/,"")).filter(Boolean).slice(0,10);
  const seed=[...(Array.isArray(input.seed_keywords)?input.seed_keywords:[])].map(x=>clean(x,120)).filter(Boolean).slice(0,20);
  if(!domain) throw new Error("domain is required");
  if(!seed.length) throw new Error("at least one seed keyword is required");
  const keywords=clusterKeywords(seed);
  const plan=makePlan(keywords,domain);
  const gaps=keywords.filter(x=>x.long_tail||x.intent==="commercial").slice(0,24).map((x,i)=>({keyword:x.keyword,opportunity:x.opportunity,why:i<8?"High-intent or long-tail opportunity":"Supporting topic opportunity",competitors_missing:competitors.length?competitors.slice(0,3):[]}));
  const pages=(Array.isArray(input.pages)?input.pages:[]).map(x=>clean(x,300)).filter(Boolean).slice(0,30);
  const internal=plan.slice(0,12).map((p,i)=>({source:p.target_url,target:pages[i%Math.max(1,pages.length)]||`https://${domain}/`,reason:"topic-cluster relevance",anchor:p.keyword}));
  const authority=competitors.map(c=>({domain:c,type:"research target",angle:"Find genuine editorial/resource/partner opportunities; do not exchange or automate links.",priority:"medium"}));
  return {schema:"izakhono.super-seo.analysis.v1",generated_at:now(),domain,competitors,seed_keywords:seed,summary:{keywords_found:keywords.length,content_opportunities:plan.length,gaps:gaps.length,authority_targets:authority.length},keywords,content_plan:plan,gaps,internal_link_map:internal,authority_opportunities:authority,guardrails:["No automated backlink exchange.","No paid ranking links; qualifying sponsored links must use appropriate rel attributes.","No mass low-value AI pages.","Every generated page requires human/product-value review before publication."],next_actions:["review_top_10_keywords","approve_first_content_cluster","publish_or_schedule","measure_search_and_leads"]};
}

async function body(req){let s="";for await(const c of req){s+=c;if(Buffer.byteLength(s)>262144)throw Object.assign(new Error("payload too large"),{status:413})}try{return JSON.parse(s||"{}")}catch{throw Object.assign(new Error("invalid JSON"),{status:400})}}
function json(res,status,data){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(data));}
async function file(res,p){try{const data=await fs.readFile(path.join(PUBLIC,p));const type=p.endsWith(".html")?"text/html":p.endsWith(".js")?"text/javascript":"text/plain";res.writeHead(200,{"content-type":`${type}; charset=utf-8`});res.end(data)}catch{res.writeHead(404);res.end("Not found")}}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,`http://${req.headers.host||"localhost"}`);if(req.method==="GET"&&u.pathname==="/health"){return json(res,200,{ok:true,service:"izakhono-super-seo",version:"0.1.0",time:now()})}if(req.method==="GET"&&u.pathname==="/api/dashboard"){return json(res,200,{service:"IZAKHONO SUPER SEO",modules:["competitor-intelligence","keyword-opportunity","content-factory","internal-linking","authority-research"],status:"READY_FOR_ANALYSIS",tracking:false})}if(req.method==="POST"&&u.pathname==="/api/analyze"){return json(res,200,analyze(await body(req)))}if(req.method==="GET"){return file(res,u.pathname==="/"?"index.html":u.pathname.replace(/^\//,""))}res.writeHead(405);res.end("Method not allowed")}catch(e){json(res,e.status||400,{error:e.message||"request failed"})}});
server.listen(PORT,()=>console.log(`IZAKHONO SUPER SEO listening on ${PORT}`));

export { analyze, clusterKeywords, makePlan };
