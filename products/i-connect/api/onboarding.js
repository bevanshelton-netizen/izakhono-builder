const {json,rpc}=require('./_lib/supabase');

module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'method_not_allowed'})}
  try{
    const body=typeof req.body==='string'?(JSON.parse(req.body||'{}')):(req.body||{});
    const name=String(body.name||'').trim();
    const slug=String(body.slug||'').trim().toLowerCase();
    const displayName=String(body.displayName||'').trim();
    const phone=String(body.phone||'').trim();
    if(!name||!slug) return json(res,400,{error:'organization_name_and_slug_required'});
    return await rpc(req,res,'ic_create_owner_organization',{p_name:name,p_slug:slug,p_display_name:displayName||null,p_phone:phone||null});
  }catch(e){return json(res,400,{error:'invalid_request'});}
};
