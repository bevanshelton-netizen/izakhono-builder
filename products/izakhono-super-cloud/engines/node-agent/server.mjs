import http from 'node:http';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT||8193);
const NODE_ID=process.env.NODE_ID||`node-${crypto.randomUUID()}`;
const REGION=process.env.NODE_REGION||'za-jhb-01';
const CAPACITY_CLASS=process.env.CAPACITY_CLASS||'owned';
const ADMIN_TOKEN=process.env.SUPER_CLOUD_ADMIN_TOKEN||'';
let workloads=new Map();
let lastCommand=null;
function json(res,status,b){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(b));}
function auth(req){return !ADMIN_TOKEN||req.headers.authorization===`Bearer ${ADMIN_TOKEN}`;}
async function body(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{};}
const server=http.createServer(async(req,res)=>{
  if(req.url==='/health'&&req.method==='GET') return json(res,200,{ok:true,engine:'node-agent',nodeId:NODE_ID});
  if(!auth(req)) return json(res,401,{error:'unauthorized'});
  if(req.url==='/v1/heartbeat'&&req.method==='GET') return json(res,200,{nodeId:NODE_ID,region:REGION,capacityClass:CAPACITY_CLASS,status:'ready',workloads:[...workloads.values()],lastCommand});
  if(req.url==='/v1/workloads'&&req.method==='POST'){
    const input=await body(req); if(!input.workloadId||!input.image)return json(res,400,{error:'workloadId_and_image_required'});
    const item={workloadId:input.workloadId,image:input.image,desiredState:input.desiredState||'running',state:'accepted',acceptedAt:new Date().toISOString()};
    workloads.set(item.workloadId,item); lastCommand={type:'deploy',workloadId:item.workloadId,at:new Date().toISOString()};
    return json(res,202,item);
  }
  if(req.url==='/v1/workloads'&&req.method==='GET') return json(res,200,{nodeId:NODE_ID,workloads:[...workloads.values()]});
  return json(res,404,{error:'not_found'});
});
server.listen(PORT,()=>console.log(`node-agent ${NODE_ID} listening on ${PORT}`));
