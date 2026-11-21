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
try {
  await waitForHealth();
  const provisioned = await request('/api/sites/provision', {method:'POST',body:JSON.stringify({site_id:'smoke_site',domain:'smoke.example.test',source_ref:'ci'})});
  if (provisioned.site?.domain !== 'smoke.example.test') throw new Error('provision failed');
  const page = await new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/', headers: { host: 'smoke.example.test' } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode || 0, html: Buffer.concat(chunks).toString('utf8') }));
    });
    req.once('error', reject);
  });
  if (page.status !== 200 || !page.html.includes('smoke.example.test')) {
    throw new Error(`site serving failed: status=${page.status}; body=${page.html.slice(0, 240)}`);
  }
  const denied = await fetch(base+'/api/workloads');
  if (denied.status !== 401) throw new Error('workload API must reject unauthenticated requests');

  const workloadSpec = {
    workloadId: 'izakhono-nav',
    workloadClass: 'navigation-platform',
    logicalNodeId: 'NODE01',
    releaseDigest: 'd'.repeat(64),
    healthPath: '/health',
    internalPort: 8080,
    idempotencyKey: 'host-smoke-nav-release-0001'
  };
  const workloadCreated = await request('/api/workloads', {method:'POST',body:JSON.stringify(workloadSpec)});
  if (workloadCreated.execution !== 'queued-awaiting-runtime-adapter' || workloadCreated.workload?.state !== 'REQUESTED') {
    throw new Error('workload request must be durably queued without claiming runtime provisioning');
  }
  const workloadReplay = await request('/api/workloads', {method:'POST',body:JSON.stringify(workloadSpec)});
  if (workloadReplay.created !== false || workloadReplay.workload?.id !== workloadCreated.workload.id) {
    throw new Error('workload idempotency replay failed');
  }
  const workloadRead = await request('/api/workloads/'+workloadCreated.workload.id);
  if (workloadRead.workload?.logical_node_id !== 'NODE01') throw new Error('workload lookup failed');

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
