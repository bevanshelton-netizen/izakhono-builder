import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDnsIntent } from './dns-control.mjs';

test('DNS intent never invents a mail host or DKIM key', () => {
  const intent = buildDnsIntent('edubuildshelton.org.za');
  assert.equal(intent.status, 'dns_pending');
  assert.equal(intent.records.find(r => r.type === 'MX').status, 'mail_host_required');
  assert.equal(intent.records.find(r => r.purpose === 'DKIM').status, 'dkim_key_required');
});

test('DNS intent accepts runtime-supplied sender and DKIM material without storing secrets', () => {
  process.env.NODE01_MAIL_MX_HOST = 'mail.example.test';
  process.env.NODE01_MAIL_SPF_IP4 = '192.0.2.10';
  process.env.NODE01_MAIL_DKIM_SELECTOR = 'node01';
  process.env.NODE01_MAIL_DKIM_PUBLIC_KEY = 'PUBLICKEY';
  const intent = buildDnsIntent('example.test');
  assert.equal(intent.records.find(r => r.type === 'MX').value, 'mail.example.test');
  assert.match(intent.records.find(r => r.purpose === 'SPF').value, /ip4:192\.0\.2\.10/);
  assert.match(intent.records.find(r => r.purpose === 'DKIM').value, /p=PUBLICKEY/);
  assert.ok(!JSON.stringify(intent).includes('PRIVATE'));
});
