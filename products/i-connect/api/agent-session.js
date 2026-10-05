const {json,rpc}=require('./_lib/supabase');
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'method_not_allowed'})}
const b=req.body||{};if(!b.organization_id)return json(res,400,{error:'organization_id_required'});
return rpc(req,res,'ic_upsert_agent_session',{p_organization_id:b.organization_id,p_state:b.state||'ready',p_device_label:b.device_label||null});};