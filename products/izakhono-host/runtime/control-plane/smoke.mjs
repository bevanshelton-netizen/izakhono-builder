import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'izakhono-runtime-'));
const port = 18080 + Math.floor(Math.random() * 500);
const token = 'smoke-token';
let childOutput = '';
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url).pathname,
  env: {...process.env, PORT:String(port), DATA_DIR:root, HOST_RUNTIME_TOKEN:token},
  stdio:['ignore','pipe','pipe']
});
child.stdout.on('data', chunk => { childOutput += chunk.toString(); });
child.stderr.on('data', chunk => { childOutput += chunk.toString(); });

const base = `http://127.0.0.1:${port}`;
async function waitForHealth() {
  for (let i=0;i<40;i++) {
    try { const r=await fetch(base+'/health'); if(r.ok) return; } catch {}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('runtime did not become healthy: ' + childOutput);
}
async function request(path, init={}) {
  const r=await fetch(base+path, {headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...init});
  const data=await r.json();
  if(!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(data)}`);
  return data;
}
function requestSite() {
  return new Promise((resolve,reject) => {
    const req=httpRequest({hostname:'127.0.0.1',port,path:'/',method:'GET',headers:{host:'smoke.example.test'}}, res => {
      const chunks=[];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);
    req.end();
  });
}
try {
  await waitForHealth();
  const provisioned = await request('/api/sites/provision', {method:'POST',body:JSON.stringify({site_id:'smoke_site',domain:'smoke.example.test',source_ref:'ci'})});
  if (provisioned.site?.domain !== 'smoke.example.test') throw new Error('provision failed: ' + JSON.stringify(provisioned));
  const page = await requestSite();
  if (page.status !== 200 || !page.body.includes('smoke.example.test')) {
    throw new Error(`site serving failed: HTTP ${page.status}; response=${page.body.slice(0,300)}; server=${childOutput}`);
  }
  const ask = await fetch(base+'/api/tls/ask?domain=smoke.example.test');
  if (!ask.ok) throw new Error('TLS admission failed: HTTP ' + ask.status);
  const accepted = await request('/api/sites/smoke_site/accept', {method:'POST',body:JSON.stringify({https:true,dns:true,content:true})});
  if (!accepted.site?.public_live) throw new Error('acceptance gate failed');
  console.log('IZAKHONO native runtime smoke test: PASS');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  await rm(root,{recursive:true,force:true});
}
