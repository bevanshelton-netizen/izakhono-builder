const OWNED_DEFAULT="https://fabric.izakhonoafrica.co.za";
const EXTERNAL_BRIDGE="https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-gateway-event";

async function post(url,body,timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(response.ok||response.status===202)return {ok:true,status:response.status,...data};
    return {ok:false,status:response.status,error:data?.error||"APP FABRIC rejected event"};
  }catch(error){
    return {ok:false,status:null,error:error?.name==="AbortError"?"timeout":String(error?.message||error)};
  }finally{clearTimeout(timer)}
}

export async function emitFabricLead({
  platformId,
  subjectRef,
  contact,
  opportunity={},
  note="",
  ownedUrl=OWNED_DEFAULT,
  ownedTimeoutMs=2400,
  externalTimeoutMs=4000,
}){
  if(!platformId||!subjectRef)return {ok:false,error:"platform_id_and_subject_ref_required"};
  const body={
    platform_id:String(platformId).slice(0,80),
    event_type:"lead.created",
    subject_ref:String(subjectRef).slice(0,180),
    contact:contact||{},
    opportunity:opportunity||{},
    note:String(note||"").slice(0,1000),
  };
  const primary=await post(String(ownedUrl||OWNED_DEFAULT).replace(/\/$/,"")+"/api/fabric/intake",body,ownedTimeoutMs);
  if(primary.ok)return {...primary,route:"owned-primary"};
  const external=await post(EXTERNAL_BRIDGE,{...body,fabric_bridge:true},externalTimeoutMs);
  if(external.ok)return {...external,route:"external-resilience",primary_error:primary.error};
  return {ok:false,route:"unavailable",primary_error:primary.error,external_error:external.error};
}

export {OWNED_DEFAULT,EXTERNAL_BRIDGE};
