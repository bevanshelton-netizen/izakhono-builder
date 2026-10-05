const {json,rpc}=require('./_lib/supabase');
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'method_not_allowed'})}
const b=req.body||{};if(!b.organization_id)return json(res,400,{error:'organization_id_required'});
return rpc(req,res,'ic_assign_next_call',{p_organization_id:b.organization_id});};