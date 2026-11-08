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

function request(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(new URL(path, target), { timeout: 15000 }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks)
      }));
    });
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    req.end();
  });
}
function json(response) {
  try { return JSON.parse(response.body.toString('utf8')); } catch { return null; }
}
async function main() {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok, detail });

  const health = await request('/health');
  const healthJson = json(health);
  add('owned engine health', health.status === 200 && healthJson?.product === 'IZAKHONO NAV ENGINE');
  add('routing ready', health.status === 200 && healthJson?.routing === 'ready');
  add('search ready', health.status === 200 && healthJson?.search === 'ready');
  add('owned map tiles ready', health.status === 200 && healthJson?.tiles === 'ready');
  add('owned runtime identity', health.status === 200 && healthJson?.runtimeClass === 'owned' && healthJson?.ready === true);

  const runtime = await request('/v1/runtime');
  const runtimeJson = json(runtime);
  add('runtime identity endpoint', runtime.status === 200 && runtimeJson?.runtimeClass === 'owned' && Boolean(runtimeJson?.releaseId));
  add('NODE01-independent engine', runtime.status === 200 && runtimeJson?.node01Required === false);

  add('TLS HSTS', Boolean(health.headers['strict-transport-security']) && /max-age=31536000/.test(health.headers['strict-transport-security']));
  add('security header: nosniff', String(health.headers['x-content-type-options'] || '') === 'nosniff');
  add('security header: referrer policy', String(health.headers['referrer-policy'] || '') === 'no-referrer');

  const root = await request('/');
  const rootText = root.body.toString('utf8');
  add('NAV application shell', root.status === 200 && rootText.includes('IZAKHONO NAV'));
  add('PWA manifest reference', root.status === 200 && rootText.includes('manifest.webmanifest'));
  add('external resilience disabled by default', root.status === 200 && rootText.includes('resilience: { enabled: false }'));

  const manifest = await request('/manifest.webmanifest');
  add('PWA manifest', manifest.status === 200 && json(manifest)?.name === 'IZAKHONO NAV');

  const serviceWorker = await request('/sw.js');
  const swText = serviceWorker.body.toString('utf8');
  add('offline tile cache handler', serviceWorker.status === 200 && swText.includes('CACHE_URLS') && swText.includes('/tiles/'));

  const search = await request('/api/search?q=Johannesburg');
  const searchData = json(search);
  add('owned place search', search.status === 200 && Array.isArray(searchData) && searchData.length > 0 && Number.isFinite(Number(searchData[0].lat)) && Number.isFinite(Number(searchData[0].lng)));

  const route = await request('/api/route/driving/28.0473,-26.2041;28.0478,-26.1950');
  const routeData = json(route);
  add('owned road route', route.status === 200 && routeData?.source === 'owned' && routeData?.geometry?.coordinates?.length > 1 && Number(routeData.distance) > 0 && Number(routeData.duration) > 0);

  const tile = await request('/tiles/10/591/589.png');
  add('owned map tile', tile.status === 200 && String(tile.headers['content-type'] || '').includes('image/') && tile.body.length > 0);

  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  }
  const failed = checks.filter(check => !check.ok);
  if (failed.length) {
    console.error(`Production verification failed: ${failed.length}/${checks.length} checks failed.`);
    process.exit(1);
  }
  console.log(`IZAKHONO NAV owned production verification passed: ${checks.length}/${checks.length}`);
}
main().catch(error => {
  console.error(`Production verification error: ${error.message}`);
  process.exit(1);
});
