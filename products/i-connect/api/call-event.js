const {json,rpc}=require('./_lib/supabase');
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'method_not_allowed'})}
const b=req.body||{};if(!b.call_id||!b.event_type)return json(res,400,{error:'call_id_and_event_type_required'});
return rpc(req,res,'ic_record_call_event',{p_call_id:b.call_id,p_event_type:b.event_type,p_payload:b.payload||{}});};