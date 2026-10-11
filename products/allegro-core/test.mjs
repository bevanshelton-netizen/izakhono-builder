import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allegro-core-'));
const port = 18988;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    ALLEGRO_DATA_DIR: dir,
    ALLEGRO_WEBHOOK_TOKEN: 'ci-webhook-token',
    ALLEGRO_INTERNAL_TOKEN: 'ci-internal-allegro-token'
  },
  stdio: 'ignore'
});

const base = `http://127.0.0.1:${port}`;
const jsonHeaders = { 'content-type': 'application/json' };

try {
  let ready = false;
  for (let i = 0; i < 50 && !ready; i++) {
    try { ready = (await fetch(`${base}/health`)).ok; } catch {}
    if (!ready) await new Promise(r => setTimeout(r, 100));
  }
  if (!ready) throw new Error('health did not become ready');

  const health = await (await fetch(`${base}/health`)).json();
  if (health.persistence !== 'local-durable-file' || health.mode !== 'owned-first') {
    throw new Error(`health contract failed: ${JSON.stringify(health)}`);
  }

  const booking = await fetch(`${base}/api/bookings`, {
    method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({ name: 'CI Test', mobile: '+27000000000', service: 'recording' })
  });
  const data = await booking.json();
  if (booking.status !== 201 || !data.ok || !data.booking?.code) throw new Error(JSON.stringify(data));

  const lookup = await fetch(`${base}/api/bookings/${data.booking.code}`);
  if (lookup.status !== 200) throw new Error('booking lookup failed');

  const lead = await fetch(`${base}/api/growth`, {
    method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({ name: 'CI Lead', email: 'ci@example.invalid', source: 'ci' })
  });
  const leadData = await lead.json();
  if (lead.status !== 201 || !leadData.ok || !leadData.lead?.id) throw new Error(JSON.stringify(leadData));

  const missingReference = await fetch(`${base}/api/payment/webhook`, {
    method: 'POST', headers: { ...jsonHeaders, 'x-allegro-webhook-token': 'ci-webhook-token' },
    body: JSON.stringify({ provider: 'ikokha', status: 'paid' })
  });
  if (missingReference.status !== 400) throw new Error(`missing reference accepted: ${missingReference.status}`);

  const first = await fetch(`${base}/api/payment/webhook`, {
    method: 'POST', headers: { ...jsonHeaders, 'x-allegro-webhook-token': 'ci-webhook-token' },
    body: JSON.stringify({ provider: 'ikokha', reference: 'CI-ALLEGRO-1', status: 'paid' })
  });
  const firstData = await first.json();
  if (first.status !== 202 || !firstData.ok || firstData.duplicate) throw new Error(JSON.stringify(firstData));

  const duplicate = await fetch(`${base}/api/payment/webhook`, {
    method: 'POST', headers: { ...jsonHeaders, 'x-allegro-webhook-token': 'ci-webhook-token' },
    body: JSON.stringify({ provider: 'ikokha', reference: 'CI-ALLEGRO-1', status: 'paid' })
  });
  const duplicateData = await duplicate.json();
  if (duplicate.status !== 200 || !duplicateData.ok || !duplicateData.duplicate || duplicateData.eventId !== firstData.eventId) {
    throw new Error(JSON.stringify(duplicateData));
  }

  const unauthorized = await fetch(`${base}/api/payment/webhook`, {
    method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({ reference: 'CI-BAD' })
  });
  if (unauthorized.status !== 401) throw new Error(`unauthorized webhook accepted: ${unauthorized.status}`);

  const selftest = await fetch(`${base}/api/selftest`, {
    method: 'POST', headers: { ...jsonHeaders, 'x-allegro-internal-token': 'ci-internal-allegro-token' },
    body: '{}'
  });
  if (selftest.status !== 200) throw new Error(`selftest failed: ${await selftest.text()}`);

  console.log(JSON.stringify({ ok: true, health: 'owned-durable', booking: 'persisted', growth: 'persisted', webhook: 'protected-idempotent', selftest: 'passed', bookingCode: data.booking.code }));
} finally {
  child.kill('SIGTERM');
  fs.rmSync(dir, { recursive: true, force: true });
}
