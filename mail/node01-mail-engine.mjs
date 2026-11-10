#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'mail', 'identities.json'), 'utf8'));

const MAIL_HOST = process.env.MAIL_HOST || 'mail.owned.izakhono';
const DKIM_SELECTOR = process.env.DKIM_SELECTOR || 'node01';
const PUBLIC_IP = process.env.MAIL_PUBLIC_IP || '';

function plan(identity) {
  const domain = identity.domain;
  return {
    business: identity.business,
    domain,
    addresses: identity.addresses.map((localPart) => `${localPart}@${domain}`),
    dns: [
      { type: 'MX', name: domain, value: `10 ${MAIL_HOST}.` },
      { type: 'TXT', name: domain, value: 'v=spf1 mx -all' },
      { type: 'TXT', name: `_dmarc.${domain}`, value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}` },
      { type: 'TXT', name: `${DKIM_SELECTOR}._domainkey.${domain}`, value: '<GENERATED_DKIM_PUBLIC_KEY>' }
    ],
    ingress: {
      smtpSubmission: `${MAIL_HOST}:587`,
      imap: `${MAIL_HOST}:993`
    },
    publicIpRequired: !PUBLIC_IP,
    status: 'PLAN_ONLY'
  };
}

function validateManifest() {
  const errors = [];
  const seen = new Set();
  for (const item of manifest.identities) {
    if (!item.domain || !item.business || !Array.isArray(item.addresses)) errors.push(`Invalid identity: ${JSON.stringify(item)}`);
    for (const localPart of item.addresses || []) {
      const address = `${localPart}@${item.domain}`.toLowerCase();
      if (seen.has(address)) errors.push(`Duplicate address: ${address}`);
      seen.add(address);
      if (!/^[a-z0-9][a-z0-9._+-]*$/.test(localPart)) errors.push(`Invalid local-part: ${address}`);
    }
  }
  return errors;
}

const errors = validateManifest();
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

const command = process.argv[2] || 'plan';
if (command === 'validate') {
  console.log(JSON.stringify({ ok: true, identities: manifest.identities.length }, null, 2));
} else if (command === 'plan') {
  console.log(JSON.stringify({
    engine: 'NODE01-MAIL-ENGINE-V1',
    ownedFirst: true,
    fallback: 'external-adapter-only',
    mailHost: MAIL_HOST,
    dkimSelector: DKIM_SELECTOR,
    identities: manifest.identities.map(plan)
  }, null, 2));
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(2);
}
