import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'izakhono-runtime-'));
const port = 18080 + Math.floor(Math.random() * 500);
const token = 'smoke-token';
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url).pathname,
  env: {...process.env, PORT:String(port), DATA_DIR:root, HOST_RUNTIME_TOKEN:token},
  stdio:['ignore','pipe','pipe']
});

const base = `http://127.0.0.1:${port}`;
async function waitForHealth() {
  for (let i=0;i<40;i++) {
    try { const r=await fetch(base+'/health'); if(r.ok) return; } catch {}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('runtime did not become healthy');
}
async function request(path, init={}) {
  const r=await fetch(base+path, {headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...init});
  const data=await r.json();
  if(!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(data)}`);
  return data;
}
try {
  await waitForHealth();
  const provisioned = await request('/api/sites/provision', {method:'POST',body:JSON.stringify({site_id:'smoke_site',domain:'smoke.example.test',source_ref:'ci'})});
  if (provisioned.site?.domain !== 'smoke.example.test') throw new Error('provision failed');
  const page = await fetch(base+'/', {headers:{host:'smoke.example.test'}});
  const html = await page.text();
  if (!page.ok || !html.includes('smoke.example.test')) throw new Error('site serving failed');
  const ask = await fetch(base+'/api/tls/ask?domain=smoke.example.test');
  if (!ask.ok) throw new Error('TLS admission failed');
  const accepted = await request('/api/sites/smoke_site/accept', {method:'POST',body:JSON.stringify({https:true,dns:true,content:true})});
  if (!accepted.site?.public_live) throw new Error('acceptance gate failed');
  console.log('IZAKHONO native runtime smoke test: PASS');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  await rm(root,{recursive:true,force:true});
}
