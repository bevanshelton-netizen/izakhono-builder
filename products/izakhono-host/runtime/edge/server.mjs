import http from 'node:http';
const control=process.env.CONTROL_PLANE||'http://control-plane:8080';
const routes=new Map();

async function refresh(){
  try{
    const r=await fetch(`${control}/api/nodes`); if(!r.ok)return;
    const data=await r.json();
    for(const node of data.nodes||[]) if(node.status==='ready') routes.set(node.node_id,node);
  }catch{}
}
setInterval(refresh,5000); refresh();

const server=http.createServer(async (req,res)=>{
  if(req.url==='/healthz'){
    res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,service:'IZAKHONO EDGE',nodes:routes.size}));
  }
  const node=[...routes.values()][0];
  if(!node){res.writeHead(503,{'content-type':'application/json'});return res.end(JSON.stringify({ok:false,error:'No healthy runtime node'}));}
  // Routing contract: domain-aware traffic selection lives here; application proxying is enabled
  // once the node exposes the deployment listener. This intentionally fails closed.
  res.writeHead(503,{'content-type':'application/json','x-izakhono-node':node.node_id});
  res.end(JSON.stringify({ok:false,error:'Route not yet bound to a production deployment',node:node.node_id}));
});
server.listen(8080,'0.0.0.0',()=>console.log('IZAKHONO EDGE listening on 8080'));
