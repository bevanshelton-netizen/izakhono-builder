import { spawn } from 'node:child_process';

const port = 8899;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: {...process.env, PORT: String(port)},
  stdio: ['ignore','pipe','pipe']
});

const waitForServer = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('server start timeout')), 5000);
  const onData = chunk => {
    if (String(chunk).includes('IZAKHONO_ONE_ENGINE=READY')) {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      resolve();
    }
  };
  child.stdout.on('data', onData);
  child.once('error', reject);
});

try {
  await waitForServer;
  const get = async path => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return {status: response.status, body: await response.json()};
  };

  const health = await get('/health');
  if (health.status !== 200 || health.body.status !== 'ok' || health.body.parallelPillars !== 7 || health.body.serviceContracts !== 7 || health.body.runtimeState !== true) throw new Error('health contract failed');

  const contracts = await get('/api/contracts');
  if (contracts.status !== 200 || contracts.body.contracts.length !== 7) throw new Error('service contract endpoint failed');

  const runtime = await get('/api/runtime');
  if (runtime.status !== 200 || runtime.body.runtime.length !== 7 || runtime.body.runtime.some(x => x.state !== 'foundation' || x.health !== 'unknown')) throw new Error('runtime state endpoint failed');

  const runtimeNav = await get('/api/runtime/nav');
  if (runtimeNav.status !== 200 || runtimeNav.body.runtime.service_slug !== 'nav') throw new Error('runtime service endpoint failed');

  const services = await get('/api/search?q=nav');
  if (services.status !== 200 || !services.body.results.some(x => x.slug === 'nav')) throw new Error('search contract failed');

  const resolved = await get('/api/resolve/fortress');
  if (resolved.status !== 200 || resolved.body.slug !== 'fortress' || !resolved.body.contract || resolved.body.runtime.state !== 'foundation') throw new Error('resolve contract failed');

  const route = await get('/api/route/nav');
  if (route.status !== 200 || route.body.status !== 'foundation' || route.body.runtime.state !== 'foundation') throw new Error('route contract failed');

  const policy = await get('/api/policy/commerce?action=payments');
  if (policy.status !== 200 || policy.body.decision !== 'review') throw new Error('policy gate contract failed');

  const denied = await get('/api/policy/commerce?action=unknown_action');
  if (denied.status !== 200 || denied.body.decision !== 'deny') throw new Error('policy deny contract failed');

  console.log('IZAKHONO ONE smoke test: PASS');
} finally {
  child.kill('SIGTERM');
}
