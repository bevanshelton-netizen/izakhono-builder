import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createUser, authDb } from './auth.mjs';
import { assertProvisionTarget } from './mail-domain-policy.mjs';
import { buildDnsIntent, verifyDnsIntent } from './dns-control.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const evidenceDir = process.env.NODE01_MAIL_EVIDENCE_DIR || resolve(root, 'evidence');

function generatedPassword() {
  return crypto.randomBytes(32).toString('base64url');
}

export async function provisionMailbox({ platform, mailbox, displayName = '' }) {
  const target = assertProvisionTarget({ platform, mailbox });
  if (!target.domain) return { ok: false, state: 'domain_required', platform: target.platform, mailbox: target.mailbox };

  const dnsVerification = await verifyDnsIntent(buildDnsIntent(target.domain));
  if (!dnsVerification.verified) {
    return { ok: false, state: 'dns_pending', platform: target.platform, mailbox: target.mailbox, domain: target.domain, dns: dnsVerification };
  }

  const address = `${target.mailbox}@${target.domain}`;
  const existing = authDb.prepare('SELECT id,address,status,display_name,created_at FROM mail_auth_users WHERE address=?').get(address);
  if (existing) {
    return { ok: true, state: existing.status === 'active' ? 'already_provisioned' : 'existing_inactive', created: false, address, platform: target.platform, domain: target.domain };
  }

  const password = generatedPassword();
  createUser({ address, password, displayName: displayName || `${target.platform} ${target.mailbox}` });

  mkdirSync(evidenceDir, { recursive: true });
  const safeName = address.replace(/[^a-z0-9._-]/gi, '_');
  const evidence = {
    schema_version: '1.0',
    controller: 'NODE01',
    policy: 'owned-first',
    platform: target.platform,
    address,
    domain: target.domain,
    state: 'provisioned_credentials_issued_once',
    password_stored: false,
    created_at: new Date().toISOString()
  };
  writeFileSync(resolve(evidenceDir, `mailbox-${safeName}.json`), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });

  return { ok: true, state: 'provisioned_credentials_issued_once', created: true, address, platform: target.platform, domain: target.domain, password };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [platform, mailbox] = process.argv.slice(2);
  if (!platform || !mailbox) {
    console.error('Usage: node src/mailbox-provisioner.mjs "Platform" mailbox');
    process.exitCode = 2;
  } else {
    const result = await provisionMailbox({ platform, mailbox });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }
}
