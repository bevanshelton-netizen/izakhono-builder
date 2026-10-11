import http from 'node:http';
import crypto from 'node:crypto';

const port = Number(process.env.PORT || 8080);
const nodes = new Map();
const deployments = new Map();
const revisions = new Map();

const json = (res, status, body) => {
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  res.end(JSON.stringify(body));
};
const id = p => `${p}_${crypto.randomUUID().replaceAll('-','')}`;

function health(res) {
  return json(res, 200, {ok:true, service:'IZAKHONO RUNTIME CONTROL PLANE', version:'1.0.0', nodes:nodes.size, deployments:deployments.size});
}

async function body(req) {
  const chunks=[];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

function chooseNode() {
  const healthy=[...nodes.values()].filter(n=>n.status==='ready');
  healthy.sort((a,b)=>(a.running||0)-(b.running||0));
  return healthy[0] || null;
}

const server=http.createServer(async (req,res)=>{
  const url=new URL(req.url, `http://${req.headers.host||'localhost'}`);
  if(req.method==='GET' && url.pathname==='/healthz') return health(res);
  if(req.method==='GET' && url.pathname==='/api/nodes') return json(res,200,{ok:true,nodes:[...nodes.values()]});

  if(req.method==='POST' && url.pathname==='/api/nodes/heartbeat') {
    const b=await body(req); const nodeId=String(b.node_id||'');
    if(!nodeId) return json(res,400,{ok:false,error:'node_id required'});
    nodes.set(nodeId,{node_id:nodeId,status:'ready',capacity:b.capacity||{},running:Number(b.running||0),last_seen:new Date().toISOString()});
    return json(res,200,{ok:true,node_id:nodeId});
  }

  if(req.method==='POST' && url.pathname==='/api/deployments') {
    const b=await body(req);
    if(!b.app || !b.image) return json(res,400,{ok:false,error:'app and immutable image are required'});
    const node=chooseNode();
    if(!node) return json(res,503,{ok:false,error:'No healthy runtime node available'});
    const revision=id('rev'); const deployment=id('dep');
    revisions.set(revision,{revision,app:b.app,image:b.image,digest:b.digest||null,created_at:new Date().toISOString()});
    deployments.set(deployment,{deployment,revision,node_id:node.node_id,app:b.app,state:'scheduled',health_path:b.health_path||'/healthz',created_at:new Date().toISOString()});
    node.running=(node.running||0)+1;
    return json(res,202,{ok:true,deployment,revision,node_id:node.node_id,state:'scheduled'});
  }

  if(req.method==='POST' && url.pathname.startsWith('/api/deployments/')) {
    const deploymentId=url.pathname.split('/')[3]; const action=url.pathname.split('/')[4];
    const d=deployments.get(deploymentId);
    if(!d) return json(res,404,{ok:false,error:'deployment not found'});
    if(action==='health-gate') {
      const b=await body(req); d.health=b.ok===true; d.state=d.health?'verified':'failed';
      if(d.state==='failed') d.rollback_required=true;
      return json(res,200,{ok:true,deployment:d});
    }
    if(action==='promote') {
      if(d.state!=='verified') return json(res,409,{ok:false,error:'Deployment must pass health gate before promotion'});
      d.state='production'; d.promoted_at=new Date().toISOString();
      return json(res,200,{ok:true,deployment:d});
    }
  }

  json(res,404,{ok:false,error:'not found'});
});

server.listen(port,'0.0.0.0',()=>console.log(`IZAKHONO control plane listening on ${port}`));
