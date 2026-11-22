import test from 'node:test';
import assert from 'node:assert/strict';
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
