const clean=(v,n=500)=>String(v??"").trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,n);
const slug=s=>clean(s,160).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

function intentFor(query){
  const q=query.toLowerCase();
  if(/price|cost|quote|supplier|buy|service|company|provider|course|training|hosting|email|repair|near me|book|contact/.test(q)) return "commercial";
  if(/how|what|why|guide|tips|requirements|learn|compare/.test(q)) return "informational";
  return "discovery";
}

export function buildGrowthPlan(input={}){
  const domain=clean(input.domain,180).replace(/^https?:\/\//,"").replace(/\/.*/,"");
  if(!domain) throw new Error("domain is required");
  const opportunities=Array.isArray(input.opportunities)?input.opportunities:[];
  const approved=opportunities
    .filter(x=>x&&clean(x.query,160))
    .map((x,i)=>({
      id:`growth-${i+1}`,
      query:clean(x.query,160),
      opportunity:Number.isFinite(Number(x.opportunity))?Math.max(0,Math.min(100,Number(x.opportunity))):50,
      intent:x.intent||intentFor(x.query),
      competitor_gap:Boolean(x.competitor_gap),
      owned_position:x.owned_position??null,
      source:x.data_source||"search-intelligence"
    }))
    .sort((a,b)=>b.opportunity-a.opportunity)
    .slice(0,20);

  const campaigns=approved.map((x,i)=>{
    const path=`/insights/${slug(x.query)}`;
    const conversion=x.intent==="commercial"?"lead":"engagement";
    return {
      id:x.id,
      priority:i<5?"P1":i<12?"P2":"P3",
      query:x.query,
      intent:x.intent,
      target_url:`https://${domain}${path}`,
      page_type:x.intent==="commercial"?"service-or-buying-guide":"educational-guide",
      title:`${x.query.replace(/\b\w/g,c=>c.toUpperCase())} | IZAKHONO`,
      primary_cta:x.intent==="commercial"?"Request a quote / start now":"Explore the next relevant resource",
      conversion_goal:conversion,
      content_requirements:[
        "Answer the search intent directly in the opening section.",
        "Use first-party expertise, evidence, examples or product detail.",
        "Add relevant internal links to owned commercial pages.",
        "Include one clear next step; avoid deceptive or forced engagement."
      ],
      internal_link_targets:[`https://${domain}/`,...(x.competitor_gap?[`https://${domain}/contact`]:[])],
      measurement:{event:conversion==="lead"?"seo_lead":"seo_engagement",source:"organic-search",campaign:x.id}
    };
  });

  return {
    schema:"izakhono.super-seo.growth.v4",
    generated_at:new Date().toISOString(),
    domain,
    summary:{opportunities_received:opportunities.length,approved_campaigns:campaigns.length,p1:campaigns.filter(x=>x.priority==="P1").length,commercial:campaigns.filter(x=>x.intent==="commercial").length},
    funnel:{stages:["search opportunity","content brief","human approval","publish","CTA conversion","lead attribution","revenue attribution"],principle:"Search demand must connect to a useful owned page and a measurable business outcome."},
    campaigns,
    attribution:{required_fields:["landing_page","query","utm_source","utm_medium","utm_campaign","session_id","lead_id","customer_id","revenue"],rules:["Do not claim revenue without a supplied transaction or CRM event.","Keep attribution first-party and consent-aware.","Separate observed metrics from estimates." ]},
    guardrails:["No automated backlink exchange.","No paid ranking links without appropriate rel attributes.","No mass low-value AI pages.","Human/product-value review is required before publication.","Never invent search volume, rankings, leads or revenue."]
  };
}

export function buildContentBrief(campaign={}){
  const q=clean(campaign.query,160); if(!q) throw new Error("query is required");
  return {
    schema:"izakhono.super-seo.content-brief.v1",
    campaign_id:clean(campaign.id,80),
    title:clean(campaign.title||q,200),
    keyword:q,
    intent:campaign.intent||intentFor(q),
    target_url:campaign.target_url,
    outline:["Direct answer / value proposition","What the buyer or learner needs to know","IZAKHONO-specific expertise, proof or examples","Practical next steps","FAQ based only on verified information","Clear CTA"],
    seo:["One descriptive title","One primary H1","Useful meta description","Logical H2/H3 hierarchy","Relevant internal links","Structured data only when the page genuinely qualifies"],
    quality_gate:["Fact checked","Original value added","No fabricated claims","No keyword stuffing","CTA matches intent","Human approved"]
  };
}
