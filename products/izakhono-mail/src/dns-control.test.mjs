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

test('DNS intent derives MX SPF DKIM and DMARC from the Stalwart zone file', () => {
  const zone = [
    '$ORIGIN example.test.',
    '@ 3600 IN MX 10 mail.example.test.',
    '@ 3600 IN TXT "v=spf1 mx ~all"',
    'node01._domainkey 3600 IN TXT "v=DKIM1; k=rsa; p=PUBLICKEY"',
    '_dmarc 3600 IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@example.test"'
  ].join('\\n');
  const intent = buildDnsIntent('example.test', zone);
  assert.equal(intent.status, 'dns_ready_for_verification');
  assert.equal(intent.records.find(r => r.type === 'MX').value, 'mail.example.test');
  assert.equal(intent.records.find(r => r.purpose === 'SPF').value, 'v=spf1 mx ~all');
  assert.equal(intent.records.find(r => r.purpose === 'DKIM').name, 'node01._domainkey');
  assert.match(intent.records.find(r => r.purpose === 'DKIM').value, /p=PUBLICKEY/);
  assert.equal(intent.records.find(r => r.purpose === 'DMARC').value, 'v=DMARC1; p=none; rua=mailto:dmarc@example.test');
});
