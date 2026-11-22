import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderDeviceDashboard, DEVICE_MANIFEST, DEVICE_ICON, DEVICE_SERVICE_WORKER } from '../src/device-dashboard.js';

test('device workspace exposes merchant-safe payment and activity workflows', () => {
  const html = renderDeviceDashboard();
  assert.match(html, /\/v1\/payment-links/);
  assert.match(html, /\/v1\/merchants\//);
  assert.match(html, /navigator\.share/);
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(html, /QRCode|qrcode\.min\.js|showQr|qrCanvas|customer-facing QR|qrwrap/);
  assert.match(html, /printReceipt/);
  assert.match(html, /verified confirmation from the connected payment provider/);
});

test('merchant credentials are not persisted by the device workspace', () => {
  const html = renderDeviceDashboard();
  assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB/);
  assert.match(html, /stays in this page's memory only/);
  assert.match(html, /apiKey=''/);
  assert.match(html, /catch\(error\)\{apiKey='';\$\('apiKey'\)\.value='';/);
});

test('PWA shell does not cache API responses or payment data', () => {
  assert.deepEqual(DEVICE_MANIFEST.start_url, '/devices');
  assert.match(DEVICE_ICON, /<svg/);
  assert.match(DEVICE_SERVICE_WORKER, /const SHELL=\['\/devices','\/device\.webmanifest','\/device-icon\.svg'\]/);
  assert.match(DEVICE_SERVICE_WORKER, /if\(request\.method!=='GET'\)return/);
  assert.match(DEVICE_SERVICE_WORKER, /url\.origin!==self\.location\.origin/);
  assert.match(DEVICE_SERVICE_WORKER, /key\.startsWith\('ipay-device-'\)/);
  assert.doesNotMatch(DEVICE_SERVICE_WORKER, /keys\.filter\(key=>key!==CACHE\)/);
});

test('merchant API key management is session-scoped and stores hashes only', async () => {
  const router = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../migrations/0017_izakhono_pay_api_key_issuance.sql', import.meta.url), 'utf8');
  assert.match(router, /api-keys\(\?:/);
  assert.match(router, /sessionMerchant\(req,env\)/);
  assert.match(router, /session\.merchantId!==merchantId/);
  assert.match(router, /SELECT id,label,key_prefix,status,created_at,last_used_at,revoked_at FROM pay_api_keys/);
  assert.match(router, /INSERT INTO pay_api_keys \(id,merchant_id,key_hash,key_prefix,label,status,created_at\)/);
  assert.match(router, /SET status='revoked',revoked_at=/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS pay_api_keys/);
  assert.match(migration, /key_hash TEXT NOT NULL UNIQUE/);
  assert.match(migration, /FOREIGN KEY \(merchant_id\) REFERENCES pay_merchants\(id\)/);
});
