const controlUrl = process.env.YHVH_CONTROL_URL || 'http://127.0.0.1:8787';
const token = process.env.YHVH_CONTROL_TOKEN || '';
const intervalMs = Math.max(10000, Number(process.env.YHVH_SUPERVISOR_INTERVAL_MS || 30000));
const enabled = String(process.env.YHVH_SUPERVISOR_ENABLED ?? 'true').toLowerCase() === 'true';

async function getStatus() {
  const r = await fetch(`${controlUrl}/api/broadcast`, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error(`broadcast_status_http_${r.status}`);
  return r.json();
}

async function startBroadcast() {
  if (!token) throw new Error('supervisor_requires_YHVH_CONTROL_TOKEN');
  const r = await fetch(`${controlUrl}/api/control/broadcast/start`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}'
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`broadcast_start_http_${r.status}:${text.slice(0,500)}`);
  return JSON.parse(text);
}

async function tick() {
  const data = await getStatus();
  const b = data.broadcast || {};
  if (b.running) return { action: 'none', reason: 'already_running', pid: b.pid };
  if (!b.approvedInputCount) return { action: 'hold', reason: 'no_cleared_content' };
  if (!enabled) return { action: 'hold', reason: 'supervisor_disabled' };
  return { action: 'start', result: await startBroadcast() };
}

async function main() {
  console.log(JSON.stringify({ service: 'yhvh-broadcast-supervisor', enabled, intervalMs, controlUrl }));
  for (;;) {
    try { console.log(JSON.stringify({ at: new Date().toISOString(), ...(await tick()) })); }
    catch (e) { console.error(JSON.stringify({ at: new Date().toISOString(), action: 'error', error: e?.message || String(e) })); }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main();
