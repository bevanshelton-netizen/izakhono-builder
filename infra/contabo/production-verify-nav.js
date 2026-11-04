const http = require('node:http');
const https = require('node:https');

const base = process.argv[2] || process.env.NAV_URL;
if (!base) {
  console.error('Usage: node infra/contabo/production-verify-nav.js <HTTPS_NAV_URL>');
  process.exit(2);
}

const target = new URL(base);
if (target.protocol !== 'https:') {
  console.error('Production verification requires HTTPS; refusing plaintext URL.');
  process.exit(2);
}
const transport = target.protocol === 'https:' ? https : http;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = transport.request(new URL(path, target), {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 10000,
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function json(body) {
  try { return JSON.parse(body); } catch (_) { return null; }
}

async function main() {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail });

  const health = await request('/health');
  const healthJson = json(health.body);
  add('health', health.status === 200 && healthJson?.product === 'IZAKHONO NAV');

  const ready = await request('/ready');
  const readyJson = json(ready.body);
  add('ready', ready.status === 200 && readyJson?.ready === true);

  const version = await request('/version');
  const versionJson = json(version.body);
  add('owned runtime', version.status === 200 && versionJson?.runtime === 'owned');
  add('TLS HSTS', Boolean(health.headers['strict-transport-security']) && /max-age=31536000/.test(health.headers['strict-transport-security']));

  const root = await request('/');
  add('NAV shell', root.status === 200 && root.body.includes('IZAKHONO NAV'));
  add('PWA manifest reference', root.status === 200 && root.body.includes('manifest.webmanifest'));

  const manifest = await request('/manifest.webmanifest');
  const manifestJson = json(manifest.body);
  add('manifest', manifest.status === 200 && manifestJson?.name === 'IZAKHONO NAV');

  const serviceWorker = await request('/sw.js');
  add('service worker', serviceWorker.status === 200 && serviceWorker.body.includes('CACHE_NAME'));

  const method = await request('/api/nav/driver-companion', { method: 'GET' });
  add('AI method guard', method.status === 405);

  const malformed = await request('/api/nav/driver-companion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{'
  });
  add('invalid JSON guard', malformed.status === 400);

  const requiredHeaders = [
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['X-Frame-Options', 'SAMEORIGIN']
  ];
  for (const [name, expected] of requiredHeaders) {
    add(`security header: ${name}`, String(health.headers[name.toLowerCase()] || '') === expected);
  }

  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  const failed = checks.filter(check => !check.ok);
  if (failed.length) {
    console.error(`Production verification failed: ${failed.length}/${checks.length} checks failed.`);
    process.exit(1);
  }
  console.log(`IZAKHONO NAV production verification passed: ${checks.length}/${checks.length}`);
}

main().catch(error => {
  console.error(`Production verification error: ${error.message}`);
  process.exit(1);
});
