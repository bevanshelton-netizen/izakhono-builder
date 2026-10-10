import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allegro-core-'));
const port = 18988;
const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('.', import.meta.url), env: { ...process.env, PORT: String(port), ALLEGRO_DATA_DIR: dir }, stdio: 'ignore' });
try {
  let ready = false;
  for (let i = 0; i < 30 && !ready; i++) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch {}
    if (!ready) await new Promise(r => setTimeout(r, 100));
  }
  if (!ready) throw new Error('health did not become ready');
  const booking = await fetch(`http://127.0.0.1:${port}/api/bookings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'CI Test', mobile: '+27000000000', service: 'recording' }) });
  const data = await booking.json();
  if (booking.status !== 201 || !data.ok || !data.booking.code) throw new Error(JSON.stringify(data));
  const lookup = await fetch(`http://127.0.0.1:${port}/api/bookings/${data.booking.code}`);
  if (lookup.status !== 200) throw new Error('booking lookup failed');
  console.log(JSON.stringify({ ok: true, bookingCode: data.booking.code }));
} finally {
  child.kill('SIGTERM');
  fs.rmSync(dir, { recursive: true, force: true });
}
