function json(res,status,body){res.status(status).json(body)}
function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):null}
function config(){return {url:process.env.I_CONNECT_SUPABASE_URL,key:process.env.I_CONNECT_SUPABASE_ANON_KEY}}
async function rpc(req,res,name,args){
  const token=bearer(req); const c=config();
  if(!token) return json(res,401,{error:'authentication_required'});
  if(!c.url||!c.key) return json(res,503,{error:'database_not_configured'});
  const r=await fetch(c.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{'content-type':'application/json',apikey:c.key,authorization:'Bearer '+token},body:JSON.stringify(args||{})});
  const text=await r.text(); let data; try{data=text?JSON.parse(text):null}catch{data={message:text}}
  if(!r.ok) return json(res,r.status,{error:'supabase_rpc_failed',details:data});
  return json(res,200,{ok:true,data});
}
module.exports={json,bearer,rpc};