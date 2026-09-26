import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'izakhono-vf-'));
const port = 19780;
const builderPort = 19781;
const ownerKey = 'owner-test';
const builderKey = 'builder-test';

const builder = http.createServer(async (req,res)=>{
  const send=(status,body)=>{
    const raw=Buffer.from(JSON.stringify(body));
    res.writeHead(status,{'content-type':'application/json','content-length':String(raw.length)});
    res.end(raw);
  };
  if(req.headers['x-admin-secret']!==builderKey) return send(401,{error:'unauthorized'});

  if(req.method==='POST' && req.url==='/api/projects'){
    let raw='';
    for await (const chunk of req) raw+=chunk;
    const body=JSON.parse(raw||'{}');
    return send(200,{ok:true,id:'proj_test_1',slug:body.slug});
  }
  if(req.method==='POST' && req.url==='/api/projects/proj_test_1/plan') return send(200,{ok:true});
  if(req.method==='POST' && req.url==='/api/projects/proj_test_1/generate') return send(200,{ok:true});
  if(req.method==='POST' && req.url==='/api/projects/proj_test_1/validate-generated') {
    return send(200,{
      ok:true,
      validation:{passed:true},
      internal_repository:{repository:'izakhono-builder',commit:'deadbeef'},
      preview:{status:'validated'}
    });
  }
  return send(404,{error:'not_found'});
});
await new Promise((resolve,reject)=>{
  builder.once('error',reject);
  builder.listen(builderPort,'127.0.0.1',resolve);
});

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    VENTURE_FACTORY_HOST: '127.0.0.1',
    VENTURE_FACTORY_DATA_DIR: dataDir,
    VENTURE_FACTORY_OWNER_KEY: ownerKey,
    VENTURE_FACTORY_PUBLIC_PLANNING: 'false',
    IZAKHONO_SUPER_AI_INTERNAL_KEY: '',
    IZAKHONO_SUPER_AI_WORKFLOW_KEY: '',
    IZAKHONO_BUILDER_URL: 'http://127.0.0.1:' + builderPort,
    IZAKHONO_BUILDER_ADMIN_KEY: builderKey,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForHealth() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/healthz');
      if (r.ok) return r.json();
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('health_timeout');
}

try {
  const health = await waitForHealth();
  if (!health.ok || health.independently_deployable !== true || health.tracking !== false) {
    throw new Error('health_contract_failed');
  }
  if (health.builder_bridge_configured !== true) throw new Error('builder_bridge_health_missing');

  const unauth = await fetch('http://127.0.0.1:' + port + '/api/plan', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({ idea: 'AI booking platform for electricians and plumbers' }),
  });
  if (unauth.status !== 401) throw new Error('owner_auth_not_enforced');

  const created = await fetch('http://127.0.0.1:' + port + '/api/plan', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-venture-factory-key': ownerKey},
    body: JSON.stringify({
      idea: 'AI booking platform for electricians and plumbers',
      country: 'South Africa',
      monthly_price_zar: 499,
      target_monthly_revenue_zar: 100000,
    }),
  });
  const data = await created.json();
  if (!created.ok || !data.ok || !data.id) throw new Error('plan_create_failed');
  if (data.plan.intelligence.mode !== 'deterministic-fallback') throw new Error('fallback_contract_failed');
  if (data.plan.venture.monthly_price_zar !== 499) throw new Error('pricing_lock_failed');
  if (data.plan.go_to_market.spend_rule.toLowerCase().indexOf('explicit approval') < 0) throw new Error('spend_gate_missing');

  const list = await fetch('http://127.0.0.1:' + port + '/api/plans', {
    headers: {'x-venture-factory-key': ownerKey},
  });
  const plans = await list.json();
  if (!list.ok || plans.plans.length !== 1) throw new Error('plan_persistence_failed');

  const build = await fetch('http://127.0.0.1:' + port + '/api/plans/' + encodeURIComponent(data.id) + '/build', {
    method: 'POST',
    headers: {'x-venture-factory-key': ownerKey},
  });
  const built = await build.json();
  if (!build.ok || !built.ok) throw new Error('builder_promotion_failed');
  if (built.build?.project?.id !== 'proj_test_1') throw new Error('builder_project_missing');
  if (built.build?.stages?.validated !== true) throw new Error('builder_validation_missing');
  if (built.build?.public_live !== false) throw new Error('public_live_gate_failed');

  const duplicate = await fetch('http://127.0.0.1:' + port + '/api/plans/' + encodeURIComponent(data.id) + '/build', {
    method: 'POST',
    headers: {'x-venture-factory-key': ownerKey},
  });
  const duplicateData = await duplicate.json();
  if (!duplicate.ok || duplicateData.already_built !== true) throw new Error('duplicate_build_guard_failed');

  const builds = await fetch('http://127.0.0.1:' + port + '/api/builds', {
    headers: {'x-venture-factory-key': ownerKey},
  });
  const buildList = await builds.json();
  if (!builds.ok || buildList.builds.length !== 1) throw new Error('build_receipt_persistence_failed');

  console.log('IZAKHONO_VENTURE_FACTORY_ENGINE_TEST=PASS');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve=>builder.close(resolve));
  await fs.rm(dataDir, { recursive: true, force: true });
}
