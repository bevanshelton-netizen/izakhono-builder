interface Fetcher { fetch(request: Request): Promise<Response>; }
interface Env { ASSETS: Fetcher; APP_ENV?: string; }

const modules = [
  { id:"builder", name:"IZAKHONO BUILDER AI", route:"/builder", status:"available", engine:"independent" },
  { id:"affiliate", name:"IZAKHONO Affiliate", route:"/affiliate", status:"integrated", engine:"independent" },
  { id:"create", name:"IZAKHONO CREATE", route:"/create", status:"available", engine:"independent" },
  { id:"ads", name:"IZAKHONO ADS", route:"/ads", status:"available", engine:"independent" },
  { id:"crm", name:"IZAKHONO CRM", route:"/crm", status:"architecture-ready", engine:"independent" },
  { id:"flow", name:"IZAKHONO FLOW", route:"/flow", status:"integrated", engine:"independent" },
  { id:"accountant", name:"SUPER ACCOUNTANT", route:"/accounting", status:"architecture-ready", engine:"independent" },
  { id:"fortress", name:"FORTRESS", route:"/fortress", status:"available", engine:"independent" },
  { id:"flowiq", name:"FLOWIQ", route:"/flowiq", status:"architecture-ready", engine:"independent" },
  { id:"tasks", name:"IZAKHONO TASKS", route:"/tasks", status:"architecture-ready", engine:"independent" }
];

const flow = {
  module_id:"flow",
  embedded:true,
  route:"/flow",
  engine:"independent",
  source_of_truth:"products/izakhono-flow",
  owned_target:"NODE01",
  public_status:"gated-until-independently-verified",
  workflow:["lead","qualify","quote","pay","fulfil","invoice","support","retain","report"],
  verified_payment_only:true,
  entity_platform_isolation:true,
  behavioural_profiling:false,
  advertising_ids:false
};

const affiliate = {
  module_id:"affiliate",
  embedded:true,
  route:"/affiliate",
  publisher_mode:true,
  network_mode:true,
  system_of_record:"IZAKHONO-owned infrastructure",
  external_adapter_count:10,
  connected_external_adapters:0,
  behavioural_profiling:false,
  advertising_ids:false,
  high_impact_owner_gate:true
};

function json(data: unknown, status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url=new URL(req.url);
    if(url.pathname==="/api/health"){
      return json({ok:true,service:"IZAKHONO SUPER APP",version:"1.1.0",env:env.APP_ENV||"production",owned_first:true});
    }
    if(url.pathname==="/api/modules"){
      return json({ok:true,modules});
    }
    if(url.pathname==="/api/affiliate/status"){
      return json({ok:true,affiliate});
    }
    if(url.pathname==="/api/flow/status"){
      return json({ok:true,flow});
    }
    if(url.pathname.startsWith("/api/")) return json({ok:false,error:"Not found"},404);
    return env.ASSETS.fetch(req);
  }
};
