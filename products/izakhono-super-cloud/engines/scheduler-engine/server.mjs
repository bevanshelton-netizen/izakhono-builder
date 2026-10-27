import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8192);
const ADMIN_TOKEN = process.env.SUPER_CLOUD_ADMIN_TOKEN || '';
const plans = new Map();
const regions = new Map([
  ['za-jhb-01',{region:'za-jhb-01',class:'owned',available:true} ],
  ['za-cpt-01',{region:'za-cpt-01',class:'owned',available:true} ],
  ['eu-fra-01',{region:'eu-fra-01',class:'external-fallback',available:true} ],
  ['us-east-01',{region:'us-east-01',class:'external-fallback',available:true} ]
]);
function json(res,status,b){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(b));}
function auth(req){return !ADMIN_TOKEN || req.headers.authorization===`Bearer ${ADMIN_TOKEN}`;}
async function body(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{};}
function choose(input){
  const requested=input.region;
  if(requested && regions.get(requested)?.available) return regions.get(requested);
  return [...regions.values()].find(r=>r.class==='owned'&&r.available) || [...regions.values()].find(r=>r.available);
}
const server=http.createServer(async(req,res)=>{
  if(req.url==='/health'&&req.method==='GET') return json(res,200,{ok:true,engine:'scheduler-engine'});
  if(!auth(req)) return json(res,401,{error:'unauthorized'});
  if(req.url==='/v1/status'&&req.method==='GET') return json(res,200,{engine:'scheduler-engine',plans:plans.size});
  if(req.url==='/v1/schedule'&&req.method==='POST'){
    const input=await body(req), target=choose(input);
    if(!target) return json(res,503,{error:'no_capacity'});
    const plan={id:crypto.randomUUID(),workloadId:input.workloadId||null,targetRegion:target.region,capacityClass:target.class,reason:target.class==='owned'?'owned-first':'owned-capacity-unavailable',state:'planned',createdAt:new Date().toISOString()};
    plans.set(plan.id,plan); return json(res,202,plan);
  }
  return json(res,404,{error:'not_found'});
});
server.listen(PORT,()=>console.log(`scheduler-engine listening on ${PORT}`));
