const {json,bearer}=require('./_lib/supabase');
module.exports=async(req,res)=>{res.setHeader('Cache-Control','no-store');if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'method_not_allowed'})}
if(!bearer(req))return json(res,401,{error:'authentication_required'});
const b=req.body||{};if(!b.call_id)return json(res,400,{error:'call_id_required'});
const url=process.env.I_CONNECT_CARRIER_BRIDGE_URL, secret=process.env.I_CONNECT_CARRIER_BRIDGE_SECRET;
if(!url||!secret)return json(res,503,{error:'carrier_not_configured',pstn_live:false,message:'Authorised carrier/SIP bridge credentials are required before real calls can be placed.'});
const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-i-connect-secret':secret},body:JSON.stringify({call_id:b.call_id,action:b.action||'bridge'})});
const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d={message:t}};return json(res,r.ok?200:502,{ok:r.ok,carrier:d});};