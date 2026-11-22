import assert from 'node:assert/strict';
import worker from './worker';

async function main() {
  const env = { DB: {} } as any;
  const health = await worker.fetch(new Request('https://code.example/health'), env);
  assert.equal(health.status, 200);
  const healthBody = await health.json() as any;
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.service, 'IZAKHONO CODE');
  assert.equal(healthBody.workspace_runner_configured, false);
  assert.equal(healthBody.model_configured, false);

  const sessions = await worker.fetch(new Request('https://code.example/v1/sessions'), env);
  assert.equal(sessions.status, 401);
  const create = await worker.fetch(new Request('https://code.example/v1/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repository: 'bevanshelton-netizen/izakhono-builder', objective: 'test' }),
  }), env);
  assert.equal(create.status, 401);
  const body = await sessions.json() as any;
  assert.equal(body.error, 'Unauthorized');
  console.log('[PASS] IZAKHONO CODE Worker health and authentication contract.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
