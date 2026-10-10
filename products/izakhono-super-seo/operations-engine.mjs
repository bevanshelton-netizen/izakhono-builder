const COMMERCIAL=/price|cost|quote|supplier|buy|service|company|provider|course|training|hosting|email|repair/i;
const INFORMATIVE=/how|what|guide|tips|requirements|learn/i;

export function classifyIntent(query){
  if(COMMERCIAL.test(query)) return "commercial";
  if(INFORMATIVE.test(query)) return "informational";
  return "discovery";
}

export function buildOperations(opportunities=[], domain=""){
  const host=String(domain).replace(/^https?:\/\//i,"").replace(/\/.*/,"").toLowerCase();
  return opportunities.slice().sort((a,b)=>b.opportunity-a.opportunity).map((o,index)=>{
    const intent=o.intent||classifyIntent(o.query||"");
    const slug=String(o.query||"seo-opportunity").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const target=`https://${host}/insights/${slug}`;
    const action=intent==="commercial"?"Create conversion-focused landing/content page":"Create useful supporting content";
    return {id:`op-${index+1}`,status:"needs_review",priority:o.opportunity>=75?"P1":o.opportunity>=55?"P2":"P3",query:o.query,intent,opportunity:o.opportunity,action,target_url:target,cta:intent==="commercial"?"Request a quote / start now":"Explore the relevant service",brief:{title:`${String(o.query||"").replace(/\b\w/g,c=>c.toUpperCase())}: Practical Guide`,purpose:action,primary_keyword:o.query,review_required:true},attribution:{campaign:`super-seo-${slug}`,lead_event:"lead_created",customer_event:"customer_created",revenue_event:"revenue_recorded"},publish:{approved:false,mode:"approval_required"}};
  });
}
export function approveOperation(operation,reviewer="human"){
  if(!operation||operation.status!=="needs_review") throw new Error("operation is not awaiting review");
  if(!reviewer) throw new Error("reviewer is required");
  return {...operation,status:"approved",reviewed_by:reviewer,reviewed_at:new Date().toISOString(),publish:{...operation.publish,approved:true,mode:"approval_required"}};
}
export function buildManifest(operations=[]){
  const approved=operations.filter(x=>x&&x.status==="approved"&&x.publish?.approved);
  return {schema:"izakhono.super-seo.operations.manifest.v1",generated_at:new Date().toISOString(),publish_mode:"approval_required",count:approved.length,items:approved.map(x=>({id:x.id,target_url:x.target_url,brief:x.brief,cta:x.cta,attribution:x.attribution}))};
}
