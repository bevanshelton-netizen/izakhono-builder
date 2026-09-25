import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'izakhono-vf-'));
const port = 19780;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    VENTURE_FACTORY_HOST: '127.0.0.1',
    VENTURE_FACTORY_DATA_DIR: dataDir,
    VENTURE_FACTORY_OWNER_KEY: 'owner-test',
    VENTURE_FACTORY_PUBLIC_PLANNING: 'false',
    IZAKHONO_SUPER_AI_INTERNAL_KEY: '',
    IZAKHONO_SUPER_AI_WORKFLOW_KEY: '',
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

  const unauth = await fetch('http://127.0.0.1:' + port + '/api/plan', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({ idea: 'AI booking platform for electricians and plumbers' }),
  });
  if (unauth.status !== 401) throw new Error('owner_auth_not_enforced');

  const created = await fetch('http://127.0.0.1:' + port + '/api/plan', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-venture-factory-key': 'owner-test'},
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
    headers: {'x-venture-factory-key': 'owner-test'},
  });
  const plans = await list.json();
  if (!list.ok || plans.plans.length !== 1) throw new Error('plan_persistence_failed');

  console.log('IZAKHONO_VENTURE_FACTORY_ENGINE_TEST=PASS');
} finally {
  child.kill('SIGTERM');
  await fs.rm(dataDir, { recursive: true, force: true });
}
