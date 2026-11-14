interface Fetcher { fetch(request: Request): Promise<Response>; }
interface Env { ASSETS:Fetcher; APP_ENV?:string; IZAKHONO_AI_GATEWAY_URL?:string; IZAKHONO_AI_GATEWAY_INTERNAL_KEY?:string; IZAKHONO_AI_WORKFLOW_KEY?:string; IZAKHONO_OWNER_ACCESS_KEY?:string; }
const modules=[{id:"builder",name:"IZAKHONO BUILDER AI",route:"/builder",status:"available",engine:"independent"},{id:"creator",name:"IZAKHONO Creator Engine",route:"/creator",status:"integrated",engine:"orchestrated-independent-engines"},{id:"affiliate",name:"IZAKHONO Affiliate",route:"/affiliate",status:"integrated",engine:"independent"},{id:"create",name:"IZAKHONO CREATE",route:"/create",status:"available",engine:"independent"},{id:"ads",name:"IZAKHONO ADS",route:"/ads",status:"available",engine:"independent"},{id:"crm",name:"IZAKHONO CRM",route:"/crm",status:"architecture-ready",engine:"independent"},{id:"flow",name:"IZAKHONO FLOW",route:"/flow",status:"integrated",engine:"independent"},{id:"finance-core",name:"IZAKHONO FINANCE CORE",route:"/finance-core",status:"integrated",engine:"independent"},{id:"accountant",name:"SUPER ACCOUNTANT",route:"/accounting",status:"architecture-ready",engine:"independent"},{id:"fortress",name:"FORTRESS",route:"/fortress",status:"available",engine:"independent"},{id:"flowiq",name:"FLOWIQ",route:"/flowiq",status:"architecture-ready",engine:"independent"},{id:"tasks",name:"IZAKHONO TASKS",route:"/tasks",status:"architecture-ready",engine:"independent"},{id:"one-drive",name:"IZAKHONO ONE DRIVE",route:"/one-drive",status:"architecture-ready",engine:"independent"}];
const creator={module_id:"creator",embedded:true,route:"/creator",engine:"orchestrated-independent-engines",source_of_truth:"products/izakhono-super-app/creator-engine.v1.json",public_status:"integration-installed-public-live-gated",principle:"one brief -> plan -> create -> adapt -> approve -> distribute -> measure",capabilities:["ideas","writing","research","design","image","video","audio","automation"],handoffs:["izakhono-super-ai","izakhono-create","izakhono-shorts","izakhono-flow","izakhono-social","izakhono-ads","izakhono-affiliate","fortress"],owned_first:true,external_adapters_replaceable:true,behavioural_profiling:false,advertising_ids:false,raw_prompt_persistence:false,paid_spend_requires_authorisation:true,publishing_requires_approved_channel_credentials:true};
const flow={module_id:"flow",embedded:true,route:"/flow",engine:"independent",source_of_truth:"products/izakhono-flow",owned_target:"NODE01",public_status:"gated-until-independently-verified",workflow:["lead","qualify","quote","pay","fulfil","invoice","support","retain","report"],verified_payment_only:true,entity_platform_isolation:true,behavioural_profiling:false,advertising_ids:false};
const financeCore={module_id:"finance-core",embedded:true,route:"/finance-core",engine:"independent",source_of_truth:"products/izakhono-finance-core",owned_target:"NODE01",public_status:"gated-until-independently-verified",regulated_activity_gated:true,software_vendor_only_by_default:true,money_movement:false,deposit_taking:false,final_automated_credit_decisions:false,behavioural_profiling:false,advertising_ids:false};
const oneDrive={module_id:"one-drive",embedded:true,route:"/one-drive",engine:"independent",source_of_truth:"products/izakhono-one-drive",owned_first:true,public_status:"gated-until-live-storage-and-security-verification",personal_space_quota_bytes:53687091200,business_space_quota_bytes:53687091200,separate_security_domains:true,public_sharing_default:false,identity_provider:"IZAKHONO CORE / FORTRESS",object_storage:"replaceable-s3-compatible-adapter",production_ready:false,physical_capacity_verified:false,live_endpoint_verified:false};
const affiliate={module_id:"affiliate",embedded:true,route:"/affiliate",publisher_mode:true,network_mode:true,system_of_record:"IZAKHONO-owned infrastructure",external_adapter_count:10,connected_external_adapters:0,behavioural_profiling:false,advertising_ids:false,high_impact_owner_gate:true};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});}
function equalSecret(a:string,b:string){if(!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function ownerOK(req:Request,env:Env){return !!env.IZAKHONO_OWNER_ACCESS_KEY&&equalSecret(req.headers.get("x-izakhono-owner-key")||"",env.IZAKHONO_OWNER_ACCESS_KEY);}
function configured(env:Env){return !!(env.IZAKHONO_AI_GATEWAY_URL&&env.IZAKHONO_AI_GATEWAY_INTERNAL_KEY&&env.IZAKHONO_AI_WORKFLOW_KEY);}
async function aiStatus(req:Request,env:Env){
 if(!ownerOK(req,env))return json({ok:false,authorized:false,error:"owner_access_required"},401);
 if(!configured(env))return json({ok:true,authorized:true,gateway_configured:false,gateway_reachable:false});
 try{const base=new URL(env.IZAKHONO_AI_GATEWAY_URL!);if(base.protocol!=="https:")return json({ok:true,authorized:true,gateway_configured:true,gateway_reachable:false});
 const r=await fetch(new URL("/healthz",base),{signal:AbortSignal.timeout(8000)});const d=await r.json() as Record<string,unknown>;
 return json({ok:true,authorized:true,gateway_configured:true,gateway_reachable:r.ok&&d.ok===true,service:"IZAKHONO SUPER AI",version:typeof d.version==="string"?d.version:undefined});
 }catch{return json({ok:true,authorized:true,gateway_configured:true,gateway_reachable:false});}
}
async function aiChat(req:Request,env:Env){
 if(!ownerOK(req,env))return json({ok:false,error:"owner_access_required"},401);
 if(!configured(env))return json({ok:false,error:"ai_runtime_unavailable"},503);
 let payload:any;try{const raw=await req.text();if(raw.length>64000)return json({ok:false,error:"request_too_large"},413);payload=JSON.parse(raw);}catch{return json({ok:false,error:"invalid_request"},400);}
 if(!Array.isArray(payload.messages)||payload.messages.length<1||payload.messages.length>30)return json({ok:false,error:"invalid_messages"},422);
 const messages=[];for(const item of payload.messages){if(!item||typeof item!=="object"||(item.role!=="user"&&item.role!=="assistant")||typeof item.content!=="string"||!item.content.trim()||item.content.length>16000)return json({ok:false,error:"invalid_message"},422);messages.push({role:item.role,content:item.content});}
 if(messages[messages.length-1].role!=="user")return json({ok:false,error:"last_message_must_be_user"},422);
 try{const base=new URL(env.IZAKHONO_AI_GATEWAY_URL!);if(base.protocol!=="https:")return json({ok:false,error:"ai_runtime_unavailable"},503);
 const upstream=await fetch(new URL("/api/v1/chat",base),{method:"POST",headers:{"content-type":"application/json","x-izakhono-ai-key":env.IZAKHONO_AI_GATEWAY_INTERNAL_KEY!,"x-izakhono-ai-workflow-key":env.IZAKHONO_AI_WORKFLOW_KEY!},body:JSON.stringify({entity_id:"izakhono-africa",subject:"izakhono-owner",product:"izakhono-ai",access_mode:"workflow",route:"owned",data_classification:"internal",messages}),signal:AbortSignal.timeout(120000)});
 const result=await upstream.json() as Record<string,any>;if(!upstream.ok||result.ok!==true)return json({ok:false,error:"ai_runtime_unavailable",upstream_status:upstream.status},503);
 return json({ok:true,answer:typeof result.answer==="string"?result.answer:typeof result.output?.text==="string"?result.output.text:"",model:result.model,route:result.route});
 }catch{return json({ok:false,error:"ai_runtime_unavailable"},503);}
}
export default {async fetch(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url);
 if(url.pathname==="/api/health")return json({ok:true,service:"IZAKHONO SUPER APP",version:"1.3.0",env:env.APP_ENV||"production",owned_first:true});
 if(url.pathname==="/api/modules")return json({ok:true,modules});
 if(url.pathname==="/api/creator/status")return json({ok:true,creator});
 if(url.pathname==="/api/affiliate/status")return json({ok:true,affiliate});
 if(url.pathname==="/api/flow/status")return json({ok:true,flow});
 if(url.pathname==="/api/finance-core/status")return json({ok:true,finance_core:financeCore});
 if(url.pathname==="/api/one-drive/status")return json({ok:true,one_drive:oneDrive});
 if(url.pathname==="/api/ai/status"&&req.method==="GET")return aiStatus(req,env);
 if(url.pathname==="/api/ai/chat"&&req.method==="POST")return aiChat(req,env);
 if(url.pathname.startsWith("/api/"))return json({ok:false,error:"Not found"},404);
 return env.ASSETS.fetch(req);
}};
