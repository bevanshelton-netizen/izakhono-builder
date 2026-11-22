import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (name) => readFile(path.join(root, name), 'utf8');

test('public site presents the I-PAY brand and approved positioning', async () => {
  const html = await read('index.html');
  assert.match(html, /<title>I-PAY™ — by IZAKHONO/);
  assert.match(html, /One brand\. One identity\. A global ambition\./);
  assert.match(html, /Business payments · Merchant management/);
  assert.match(html, /I-PAY symbol/);
});

test('merchant tariffs are explicitly non-binding proposals', async () => {
  const html = await read('index.html');
  const tariff = await read('docs/I-PAY-COMMERCIAL-TARIFF-PROPOSAL-v1.md');
  assert.match(html, /Proposed tariff — not yet an active offer/);
  assert.match(html, /not binding quotes or currently available merchant tariffs/);
  assert.match(tariff, /PROPOSAL ONLY — NOT ACTIVE OR BINDING/);
  assert.match(tariff, /Activation gates/);
});

test('proposed wallet and global products are not represented as live services', async () => {
  const html = await read('index.html');
  assert.match(html, /I-PAY Wallet/);
  assert.match(html, /Proposed · approvals required/);
  assert.match(html, /I-PAY Global/);
  assert.match(html, /market approvals required/);
});

test('operations, checkout and merchant dashboard use the customer-facing brand', async () => {
  const operations = await read('public/index.html');
  const mockCheckout = await read('public/mock-checkout.html');
  const worker = await read('src/index.ts');
  const dashboard = await read('src/merchant-dashboard.ts');
  assert.match(operations, /I-PAY™ — by IZAKHONO/);
  assert.match(mockCheckout, /I-PAY™ Sandbox Checkout/);
  assert.match(worker, /I-PAY™ — by IZAKHONO/);
  assert.match(dashboard, /I-PAY™ — Merchant Console/);
});

test('release documentation distinguishes Vercel website and Worker deployment', async () => {
  const readme = await read('README.md');
  assert.match(readme, /Vercel website deployment and Cloudflare Worker deployment are separate release targets/);
  assert.match(readme, /does not declare a static-assets binding/);
  assert.match(readme, /must not be treated as one tested runtime/);
});
