import "server-only";

export type ReadyNode = { node_id:string; state:string; health:string; security_posture:string; capabilities:string[]; runtime_version?:string; revision?:string|null };

function config() {
  const raw=process.env.IZAKHONO_NODE_CONTROL_URL, token=process.env.IZAKHONO_CONTROL_TOKEN;
  if(!raw||!token) return {ok:false as const,reason:"NODE_CONTROL_NOT_CONFIGURED"};
  let url:URL; try{url=new URL(raw)}catch{return {ok:false as const,reason:"NODE_CONTROL_URL_INVALID"}}
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash) return {ok:false as const,reason:"NODE_CONTROL_URL_MUST_BE_HTTPS_ORIGIN"};
  return {ok:true as const,base:url.toString().replace(/\/$/,""),token};
}
async function request(path:string,method="GET",body?:unknown){
 const c=config(); if(!c.ok)return {ok:false as const,reason:c.reason,status:503};
 try{
  const response=await fetch(c.base+path,{method,redirect:"manual",cache:"no-store",headers:{accept:"application/json",authorization:"Bearer "+c.token,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(6000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)return {ok:false as const,reason:"NODE_CONTROL_HTTP_"+response.status,status:response.status};
  return {ok:true as const,data};
 }catch{return {ok:false as const,reason:"NODE_CONTROL_UNREACHABLE",status:502}}
}
/** Reads IZAKHONO ONE's ready registry; it never registers or promotes a node. */
export async function getReadySoftwareNodes(){
 const result=await request("/api/nodes"); if(!result.ok)return result;
 const nodes=Array.isArray(result.data?.nodes)?result.data.nodes:[];
 return {ok:true as const,nodes:nodes.map((n:any):ReadyNode=>({node_id:String(n.node_id||""),state:String(n.state||"unknown"),health:String(n.health||"unknown"),security_posture:String(n.security_posture||"unknown"),capabilities:Array.isArray(n.capabilities)?n.capabilities.map(String):[],runtime_version:n.runtime_version,revision:n.revision??null}))};
}
/** FORTRESS workload authorization only. Authorization is not deployment. */
export async function authorizeFreightWorkload(nodeId:string,revision:string){
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/.test(nodeId))return {ok:false as const,reason:"INVALID_NODE_ID",status:400};
 if(!/^[a-f0-9]{7,64}$/i.test(revision))return {ok:false as const,reason:"REVISION_MUST_BE_A_COMMIT_SHA",status:400};
 return request("/api/nodes/"+encodeURIComponent(nodeId)+"/workload","POST",{revision,correlation_id:"sfg-"+revision.slice(0,12)});
}
