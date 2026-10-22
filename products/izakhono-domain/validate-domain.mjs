#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname);
const zonePath = path.join(root, 'coredns', 'izakhono.db');
const corefilePath = path.join(root, 'coredns', 'Corefile');
const requiredNames = [
  'ns1', 'mail', 'webmail', 'smtp', 'imap', 'identity',
  'cloud', 'pay', 'nav', 'voice'
];

const failures = [];

function requireText(file, text, label) {
  const value = fs.readFileSync(file, 'utf8');
  if (!value.includes(text)) failures.push(`${label}: missing ${text}`);
  return value;
}

const zone = requireText(zonePath, '$ORIGIN izakhono.', 'zone');
requireText(corefilePath, 'izakhono:53', 'CoreDNS Corefile');
requireText(corefilePath, 'file /etc/coredns/izakhono.db', 'CoreDNS Corefile');

for (const name of requiredNames) {
  const pattern = new RegExp(`^${name}\\s+IN\\s+A\\s+`, 'm');
  if (!pattern.test(zone)) failures.push(`zone: missing A record for ${name}.izakhono`);
}

if (!zone.includes('@ IN NS ns1.izakhono.')) failures.push('zone: missing authoritative NS record');
if (!zone.includes('SOA ns1.izakhono.')) failures.push('zone: missing SOA record');

const report = {
  namespace: 'izakhono',
  public: false,
  authoritative: failures.length === 0,
  required_services: requiredNames.map((name) => `${name}.izakhono`),
  failures
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
