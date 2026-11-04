const http = require('node:http');
const base = process.env.NAV_URL || 'http://127.0.0.1:8080';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(path, base), options, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('request timed out')));
    req.on('error', reject);
    req.end(options.body);
  });
}

async function main() {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail });

  const health = await request('/health');
  add('health', health.status === 200 && JSON.parse(health.body).product === 'IZAKHONO NAV');
  add('security headers', health.headers['x-content-type-options'] === 'nosniff' && Boolean(health.headers['x-request-id']));

  const ready = await request('/ready');
  add('ready', ready.status === 200 && JSON.parse(ready.body).ready === true);

  const version = await request('/version');
  add('version', version.status === 200 && JSON.parse(version.body).runtime === 'owned');

  const method = await request('/api/nav/driver-companion', { method: 'GET' });
  add('AI method guard', method.status === 405);

  const malformed = await request('/api/nav/driver-companion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  add('invalid JSON guard', malformed.status === 400 && JSON.parse(malformed.body).error === 'invalid_json');

  const oversized = await request('/api/nav/driver-companion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'x'.repeat(1024 * 1024 + 32) })
  });
  add('request body size guard', oversized.status === 413 && JSON.parse(oversized.body).error === 'payload_too_large');

  const html = await request('/');
  add('NAV shell', html.status === 200 && html.body.includes('IZAKHONO NAV'));
  add('PWA manifest link', html.status === 200 && html.body.includes('manifest.webmanifest'));

  const head = await request('/', { method: 'HEAD' });
  add('HEAD response', head.status === 200 && head.body.length === 0);

  const manifest = await request('/manifest.webmanifest');
  let manifestValid = false;
  try {
    const parsed = JSON.parse(manifest.body);
    manifestValid = manifest.status === 200 && parsed.name === 'IZAKHONO NAV' && parsed.display === 'standalone';
  } catch {}
  add('PWA manifest served', manifestValid);

  const failed = checks.filter(x => !x.ok);
  for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  if (failed.length) process.exit(1);
  console.log(`IZAKHONO NAV production smoke test passed: ${checks.length}/${checks.length}`);
}

main().catch(error => { console.error(`FAIL smoke test — ${error.message}`); process.exit(1); });
