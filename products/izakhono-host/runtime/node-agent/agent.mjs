import http from 'node:http';
const nodeId=process.env.NODE_ID||'NODE01';
const control=process.env.CONTROL_PLANE||'http://control-plane:8080';
const workRoot=process.env.WORK_ROOT||'/var/lib/izakhono/work';

async function heartbeat(){
  const payload=JSON.stringify({node_id:nodeId,capacity:{cpu:'software-scheduler',memory:'container-managed',storage:workRoot},running:0});
  const r=await fetch(`${control}/api/nodes/heartbeat`,{method:'POST',headers:{'content-type':'application/json'},body:payload});
  if(!r.ok) throw new Error(`heartbeat ${r.status}`);
}
async function tick(){try{await heartbeat();console.log(`${nodeId} ready`)}catch(e){console.error(`${nodeId} heartbeat failed`,e.message)}}
tick(); setInterval(tick,15000);

http.createServer((req,res)=>{if(req.url==='/healthz'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,node:nodeId}))}else{res.writeHead(404);res.end()}}).listen(8081,'0.0.0.0');
