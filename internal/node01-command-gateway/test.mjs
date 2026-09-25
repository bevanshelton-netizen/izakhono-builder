import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'izakhono-command-test-'));
const ownerFile=path.join(tmp,'owner');
const controlFile=path.join(tmp,'control');
await fs.writeFile(ownerFile,'owner-test\n');
await fs.writeFile(controlFile,'control-test\n');

const control=http.createServer(async(req,res)=>{
  const auth=req.headers.authorization||'';
  if(auth!=='Bearer control-test'){res.writeHead(401,{'content-type':'application/json'});res.end('{"error":"bad-auth"}');return;}
  if(req.method==='GET'&&req.url==='/healthz'){res.end('{"ok":true}');return;}
  if(req.method==='GET'&&req.url==='/v1/node'){res.end('{"node_id":"node01","ready":true}');return;}
  if(req.method==='GET'&&req.url==='/v1/status'){res.end('{"ok":true,"jobs":[]}');return;}
  if(req.method==='POST'&&req.url==='/v1/deploy'){
    let body='';for await(const chunk of req)body+=chunk;
    const job=JSON.parse(body);
    assert.equal(job.app,'izakhono-commands');
    assert.equal(job.repository,'izakhono-builder');
    assert.match(job.ref,/^[0-9a-f]{40}$/);
    res.writeHead(202,{'content-type':'application/json'});
    res.end('{"id":"job_test","status":"queued"}');return;
  }
  res.writeHead(404,{'content-type':'application/json'});res.end('{"error":"not-found"}');
});
await new Promise(resolve=>control.listen(19292,'127.0.0.1',resolve));

const child=spawn(process.execPath,['internal/node01-command-gateway/server.mjs'],{
  cwd:process.cwd(),
  env:{...process.env,IZAKHONO_BIND_HOST:'127.0.0.1',IZAKHONO_COMMAND_PORT:'18091',IZAKHONO_CONTROL_ORIGIN:'http://127.0.0.1:19292',IZAKHONO_OWNER_HOST_ORIGIN:'http://127.0.0.1',IZAKHONO_COMMAND_OWNER_TOKEN_FILE:ownerFile,IZAKHONO_CONTROL_TOKEN_FILE:controlFile,IZAKHONO_EXTERNAL_COMMAND_ORIGIN:'http://127.0.0.1:19999'},
  stdio:['ignore','pipe','pipe']
});

async function wait(){
  for(let i=0;i<50;i++){
    try{const r=await fetch('http://127.0.0.1:18091/healthz');if(r.ok)return;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('gateway did not start');
}

try{
  await wait();
  let r=await fetch('http://127.0.0.1:18091/api/commands');
  assert.equal(r.status,401);

  r=await fetch('http://127.0.0.1:18091/api/commands',{headers:{'x-admin-secret':'owner-test'}});
  assert.equal(r.status,200);
  let d=await r.json();
  assert.equal(d.ok,true);
  assert.ok(d.commands.some(c=>c.name==='deploy'));

  r=await fetch('http://127.0.0.1:18091/api/commands/run',{method:'POST',headers:{'content-type':'application/json','x-admin-secret':'owner-test'},body:JSON.stringify({input:'/node'})});
  assert.equal(r.status,200);
  d=await r.json();
  assert.equal(d.data.node_id,'node01');

  const sha='a'.repeat(40);
  r=await fetch('http://127.0.0.1:18091/api/commands/run',{method:'POST',headers:{'content-type':'application/json','x-admin-secret':'owner-test'},body:JSON.stringify({input:'/deploy izakhono-commands '+sha})});
  assert.equal(r.status,202);
  d=await r.json();
  assert.equal(d.data.status,'queued');

  console.log('IZAKHONO_COMMAND_GATEWAY_CONTROL_NODE_TEST=PASS');
} finally {
  child.kill('SIGTERM');
  control.close();
  await fs.rm(tmp,{recursive:true,force:true});
}
