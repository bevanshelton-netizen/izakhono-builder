interface Fetcher { fetch(request: Request): Promise<Response>; }
interface Env { ASSETS: Fetcher; APP_ENV?: string; }

const modules = [
  { id:"builder", name:"IZAKHONO BUILDER AI", route:"/builder", status:"available", engine:"independent" },
  { id:"creator", name:"IZAKHONO Creator Engine", route:"/creator", status:"integrated", engine:"orchestrated-independent-engines" },
  { id:"affiliate", name:"IZAKHONO Affiliate", route:"/affiliate", status:"integrated", engine:"independent" },
  { id:"create", name:"IZAKHONO CREATE", route:"/create", status:"available", engine:"independent" },
  { id:"ads", name:"IZAKHONO ADS", route:"/ads", status:"available", engine:"independent" },
  { id:"crm", name:"IZAKHONO CRM", route:"/crm", status:"architecture-ready", engine:"independent" },
  { id:"flow", name:"IZAKHONO FLOW", route:"/flow", status:"integrated", engine:"independent" },
  { id:"finance-core", name:"IZAKHONO FINANCE CORE", route:"/finance-core", status:"integrated", engine:"independent" },
  { id:"accountant", name:"SUPER ACCOUNTANT", route:"/accounting", status:"architecture-ready", engine:"independent" },
  { id:"fortress", name:"FORTRESS", route:"/fortress", status:"available", engine:"independent" },
  { id:"flowiq", name:"FLOWIQ", route:"/flowiq", status:"architecture-ready", engine:"independent" },
  { id:"tasks", name:"IZAKHONO TASKS", route:"/tasks", status:"architecture-ready", engine:"independent" }
];

const creator = {
  module_id:"creator",
  embedded:true,
  route:"/creator",
  engine:"orchestrated-independent-engines",
  source_of_truth:"products/izakhono-super-app/creator-engine.v1.json",
  public_status:"integration-installed-public-live-gated",
  principle:"one brief -> plan -> create -> adapt -> approve -> distribute -> measure",
  capabilities:["ideas","writing","research","design","image","video","audio","automation"],
  handoffs:["izakhono-super-ai","izakhono-create","izakhono-shorts","izakhono-flow","izakhono-social","izakhono-ads","izakhono-affiliate","fortress"],
  owned_first:true,
  external_adapters_replaceable:true,
  behavioural_profiling:false,
  advertising_ids:false,
  raw_prompt_persistence:false,
  paid_spend_requires_authorisation:true,
  publishing_requires_approved_channel_credentials:true
};

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

const financeCore = {
  module_id:"finance-core",
  embedded:true,
  route:"/finance-core",
  engine:"independent",
  source_of_truth:"products/izakhono-finance-core",
  owned_target:"NODE01",
  public_status:"gated-until-independently-verified",
  regulated_activity_gated:true,
  software_vendor_only_by_default:true,
  money_movement:false,
  deposit_taking:false,
  final_automated_credit_decisions:false,
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
      return json({ok:true,service:"IZAKHONO SUPER APP",version:"1.2.0",env:env.APP_ENV||"production",owned_first:true});
    }
    if(url.pathname==="/api/modules"){
      return json({ok:true,modules});
    }
    if(url.pathname==="/api/creator/status"){
      return json({ok:true,creator});
    }
    if(url.pathname==="/api/affiliate/status"){
      return json({ok:true,affiliate});
    }
    if(url.pathname==="/api/flow/status"){
      return json({ok:true,flow});
    }
    if(url.pathname==="/api/finance-core/status"){
      return json({ok:true,finance_core:financeCore});
    }
    if(url.pathname.startsWith("/api/")) return json({ok:false,error:"Not found"},404);
    return env.ASSETS.fetch(req);
  }
};
