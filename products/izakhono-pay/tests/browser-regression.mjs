import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Script } from 'node:vm';
import { chromium } from 'playwright';
import { renderDeviceDashboard } from '../src/device-dashboard.js';
import { renderMerchantDashboard } from '../src/merchant-dashboard.ts';

// Parse the exact inline JavaScript emitted into the device page before Chromium starts.
// This turns opaque browser parse errors into a deterministic filename/line/column failure.
const renderedDeviceHtml = renderDeviceDashboard('static-script-validation');
const inlineScripts = [...renderedDeviceHtml.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)];
assert.ok(inlineScripts.length > 0, 'device dashboard must emit its application script');
inlineScripts.forEach((match, index) => new Script(match[1], { filename: 'device-dashboard.inline-' + index + '.js' }));

const keys = new Map();
let keySequence = 0;
const json = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
};
const readBody = async req => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};
const policy = nonce => [
  "default-src 'none'",
  `script-src 'nonce-${nonce}'`,
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'"
].join('; ');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = url.pathname;
  const session = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('ipay_test_session='))?.split('=')[1];

  if (req.method === 'GET' && (path === '/devices' || /^\/dashboard\/[^/]+$/.test(path))) {
    const merchantId = path.startsWith('/dashboard/') ? path.split('/')[2] : null;
    if (merchantId && session !== merchantId) {
      res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end('Merchant sign-in required');
      return;
    }
    const nonce = `browser-test-${Math.random().toString(36).slice(2)}`;
    const html = path === '/devices' ? renderDeviceDashboard(nonce) : renderMerchantDashboard(merchantId, nonce);
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': policy(nonce)
    });
    // Deliberately inject an untrusted inline script: a real browser must block it.
    res.end(html.replace('</body>', '<script>window.__untrustedInlineRan = true</script></body>'));
    return;
  }

  if (path.startsWith('/v1/merchants/')) {
    const parts = path.split('/').filter(Boolean);
    const merchantId = parts[2];
    if (parts[3] === 'api-keys') {
      if (session !== merchantId) return json(res, 403, { error: 'merchant_unauthorized' });
      if (req.method === 'GET' && parts.length === 4) return json(res, 200, { merchant_id: merchantId, data: keys.get(merchantId) || [] });
      if (req.method === 'POST' && parts.length === 4) {
        const body = await readBody(req);
        const item = { id: `key-${++keySequence}`, label: body.label, key_prefix: 'ipay_test_', status: 'active', created_at: new Date().toISOString() };
        keys.set(merchantId, [...(keys.get(merchantId) || []), item]);
        return json(res, 201, { ...item, api_key: 'ipay_test_secret_once' });
      }
      if (req.method === 'POST' && parts[5] === 'revoke') {
        const list = keys.get(merchantId) || [];
        const item = list.find(x => x.id === parts[4] && x.status === 'active');
        if (!item) return json(res, 404, { error: 'api_key_not_found_or_inactive' });
        item.status = 'revoked';
        return json(res, 200, { ok: true, id: item.id, status: 'revoked' });
      }
    }
    if (req.method === 'GET' && parts.length === 3) {
      if (req.headers.authorization !== 'Bearer browser-test-key' || merchantId !== 'demo') return json(res, 403, { error: 'merchant_unauthorized' });
      return json(res, 200, { id: merchantId, name: 'Demo merchant' });
    }
    if (req.method === 'GET' && parts[3] === 'control-centre') return json(res, 200, { merchant: { status: 'active' }, financials: {}, providers: [], compliance: {} });
    if (req.method === 'GET' && parts[3] === 'summary') return json(res, 200, { transactions: 0, processed_volume: 0, pending_volume: 0, currency: 'ZAR' });
    if (req.method === 'GET' && parts[3] === 'transactions') return json(res, 200, { data: [] });
  }
  if (req.method === 'POST' && path === '/v1/payment-links') return json(res, 201, { id: 'link-test', url: '/pay/test-token', amount: 125, currency: 'ZAR', status: 'active' });
  json(res, 404, { error: 'not_found' });
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
try {
  const deviceContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  await deviceContext.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.__cspViolations.push(event.violatedDirective));
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { window.__shareCalled = true; } });
  });
  const device = await deviceContext.newPage();
  const browserDiagnostics = [];
  device.on('pageerror', error => browserDiagnostics.push('pageerror: ' + error.message + ' stack: ' + error.stack));
  device.on('console', message => { if (message.type() === 'error') browserDiagnostics.push('console: ' + message.text()); });
  device.on('requestfailed', request => browserDiagnostics.push('request failed: ' + request.method() + ' ' + request.url() + ' ' + (request.failure()?.errorText || 'unknown')));
  device.on('response', response => { if (new URL(response.url()).pathname.startsWith('/v1/')) browserDiagnostics.push('API ' + response.status() + ' ' + new URL(response.url()).pathname); });
  await device.goto(`${origin}/devices`);
  const devicePolicy = await device.locator('html').evaluate(() => document.contentType).then(async () => (await device.request.get(`${origin}/devices`)).headers()['content-security-policy']);
  assert.match(devicePolicy, /script-src 'nonce-[^']+'/);
  assert.equal(await device.evaluate(() => window.__untrustedInlineRan), undefined, 'untrusted inline script must be blocked by CSP');
  await device.locator('#merchantId').fill('demo');
  await device.locator('#apiKey').fill('browser-test-key');
  await device.locator('#connectForm button[type=submit]').click();
  try {
    await device.locator('#app:not(.hidden)').waitFor({ timeout: 10000 });
  } catch (error) {
    const message = await device.locator('#connectMessage').textContent().catch(() => '');
    throw new Error('Merchant workspace did not open. Connect message: ' + message + '. Browser diagnostics: ' + browserDiagnostics.join(' | '), { cause: error });
  }
  await device.locator('#linkTitle').fill('Browser regression payment');
  await device.locator('#linkAmount').fill('125');
  await device.locator('#linkForm button[type=submit]').click();
  await device.locator('#linkResult').waitFor({ state: 'visible' });
  await device.locator('#copyLink').click();
  assert.match(await device.locator('#linkMessage').textContent(), /copied/i);
  await device.locator('#shareLink').click();
  assert.equal(await device.evaluate(() => window.__shareCalled), true, 'device workspace should invoke the native share flow');
  await deviceContext.close();

  const merchantContext = await browser.newContext();
  await merchantContext.addCookies([{ name: 'ipay_test_session', value: 'demo', url: origin, httpOnly: true, sameSite: 'Lax' }]);
  await merchantContext.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.__cspViolations.push(event.violatedDirective));
  });
  const merchant = await merchantContext.newPage();
  await merchant.goto(`${origin}/dashboard/demo`);
  const merchantPolicy = (await merchant.request.get(`${origin}/dashboard/demo`)).headers()['content-security-policy'];
  assert.match(merchantPolicy, /script-src 'nonce-[^']+'/);
  assert.equal(await merchant.evaluate(() => window.__untrustedInlineRan), undefined, 'merchant dashboard must block untrusted inline scripts');
  await merchant.locator('#keyLabel').fill('Browser test key');
  await merchant.locator('[data-action="create-key"]').click();
  await merchant.locator('#keyOut .secret').waitFor();
  assert.match(await merchant.locator('#keyOut').textContent(), /ipay_test_secret_once/);
  const revoke = merchant.locator('[data-revoke-id]').first();
  await merchant.evaluate(() => { window.confirm = () => true; });
  await revoke.click();
  await merchant.locator('#keys').getByText(/revoked/i).waitFor();
  const isolation = await merchant.evaluate(async () => {
    const response = await fetch('/v1/merchants/another-merchant/api-keys');
    return response.status;
  });
  assert.equal(isolation, 403, 'a merchant session must not access another merchant API-key collection');
  await merchantContext.close();

  const anonymous = await browser.newPage();
  const denied = await anonymous.goto(`${origin}/dashboard/demo`);
  assert.equal(denied.status(), 401, 'merchant dashboard must reject a missing session');
  console.log('Browser regression passed: enforced CSP, device copy/share, API-key create/revoke, and session/merchant isolation.');
} finally {
  await browser.close();
  server.close();
}
