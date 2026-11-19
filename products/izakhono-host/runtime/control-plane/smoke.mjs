import { spawn } from 'node:child_process';
import http from 'node:http';
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

async function requestSiteWithHostHeader() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/',
      method: 'GET',
      headers: { Host: 'smoke.example.test' },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        statusCode: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}
try {
  await waitForHealth();
  const provisioned = await request('/api/sites/provision', {method:'POST',body:JSON.stringify({site_id:'smoke_site',domain:'smoke.example.test',source_ref:'ci'})});
  if (provisioned.site?.domain !== 'smoke.example.test') throw new Error('provision failed');
  const page = await requestSiteWithHostHeader();
  if (page.statusCode !== 200 || !page.body.includes('smoke.example.test')) throw new Error(`site serving failed: ${page.statusCode}`);
  const unauthorized = await fetch(base+'/api/sites');
  if (unauthorized.status !== 401) throw new Error('owner authorization boundary failed');
  const ask = await fetch(base+'/api/tls/ask?domain=smoke.example.test');
  if (!ask.ok) throw new Error('TLS admission failed');
  const booleanOnly = await fetch(base+'/api/sites/smoke_site/accept', {
    method:'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({https:true,dns:true,content:true}),
  });
  if (booleanOnly.status !== 409) throw new Error('boolean-only acceptance bypassed evidence gate');
  const staleEvidence = Object.fromEntries(['https','dns','content'].map(kind => [kind, {
    verified:true, evidence_id:`stale-${kind}`, observed_at:new Date(Date.now()-48*60*60*1000).toISOString(),
  }]));
  const stale = await fetch(base+'/api/sites/smoke_site/accept', {
    method:'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({evidence:staleEvidence}),
  });
  if (stale.status !== 409) throw new Error('stale acceptance evidence was accepted');
  const observedAt = new Date().toISOString();
  const evidence = Object.fromEntries(['https','dns','content'].map(kind => [kind, {
    verified:true, evidence_id:`ci-${kind}`, observed_at:observedAt,
  }]));
  const accepted = await request('/api/sites/smoke_site/accept', {method:'POST',body:JSON.stringify({evidence})});
  if (!accepted.site?.public_live) throw new Error('evidence-backed acceptance gate failed');
  console.log('IZAKHONO native runtime smoke test: PASS');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  await rm(root,{recursive:true,force:true});
}
