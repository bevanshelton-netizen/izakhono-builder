import { spawn } from 'node:child_process';

const port = 8900;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});
const waitForServer = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('adapter route server start timeout')), 5000);
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
    return { status: response.status, body: await response.json() };
  };
  const registry = await get('/api/adapters');
  if (registry.status !== 200 || registry.body.mode !== 'prepare_only' || registry.body.adapters.length !== 7) {
    throw new Error('adapter registry endpoint failed');
  }
  if (registry.body.adapters.some(adapter => adapter.execution !== 'prepare_only' || adapter.sideEffects !== false || !adapter.requiresFortressGate)) {
    throw new Error('adapter safety boundary failed');
  }
  const nav = await get('/api/adapters/nav');
  if (nav.status !== 200 || nav.body.adapter.service !== 'nav' || !nav.body.adapter.capabilities.includes('navigation')) {
    throw new Error('single adapter endpoint failed');
  }
  const prepared = await fetch(`http://127.0.0.1:${port}/api/adapter-request`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ service: 'nav', action: 'navigation' })
  });
  const preparedBody = await prepared.json();
  if (prepared.status !== 200 || preparedBody.dispatchable !== false || preparedBody.sideEffects !== false || preparedBody.adapter?.execution !== 'prepare_only') {
    throw new Error('adapter preparation must remain fail-closed');
  }
  const malformed = await fetch(`http://127.0.0.1:${port}/api/adapter-request`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  if (malformed.status !== 400 || (await malformed.json()).error !== 'invalid_json') throw new Error('malformed JSON must be rejected');
  const oversized = await fetch(`http://127.0.0.1:${port}/api/adapter-request`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(65537) });
  if (oversized.status !== 413 || (await oversized.json()).error !== 'payload_too_large') throw new Error('oversized JSON must be rejected');
  const unknown = await get('/api/adapters/not-a-service');
  if (unknown.status !== 404 || unknown.body.error !== 'adapter_not_found') {
    throw new Error('unknown adapter must return 404');
  }
  console.log('IZAKHONO ONE adapter route tests: PASS');
} finally {
  child.kill('SIGTERM');
}
