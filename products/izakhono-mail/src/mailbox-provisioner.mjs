import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertProvisionTarget } from './mail-domain-policy.mjs';
import { buildDnsIntent, verifyDnsIntent } from './dns-control.mjs';
import { createStalwartTransportFromEnv } from './stalwart-jmap.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const evidenceDir = process.env.NODE01_MAIL_EVIDENCE_DIR || resolve(root, 'evidence');

function generatedPassword() {
  return crypto.randomBytes(32).toString('base64url');
}

function failure(state, target, extra = {}) {
  return {
    ok: false,
    state,
    platform: target.platform,
    mailbox: target.mailbox,
    ...(target.domain ? { domain: target.domain } : {}),
    ...extra,
  };
}

export async function provisionMailbox({
  platform, mailbox, displayName = '',
  transportFactory = createStalwartTransportFromEnv,
  dnsVerifier = verifyDnsIntent,
  dnsIntentBuilder = buildDnsIntent,
  evidenceDirectory = evidenceDir,
}) {
  const target = assertProvisionTarget({ platform, mailbox });
  if (!target.domain) return failure('domain_required', target);

  let transport;
  try {
    transport = transportFactory();
  } catch {
    return failure('transport_unavailable', target, { required_configuration: [
      'STALWART_JMAP_URL', 'STALWART_PROVISIONER_API_KEY',
    ] });
  }

  let domainState;
  try {
    domainState = await transport.ensureDomain(target.domain);
  } catch (error) {
    const errorCode = String(error?.message || 'stalwart_domain_setup_failed').slice(0, 120);
    return failure(errorCode === 'stalwart-domain-not-provisioned' ? 'domain_not_provisioned' : 'transport_domain_setup_failed', target, {
      error_code: errorCode,
    });
  }

  let dnsVerification;
  try {
    dnsVerification = await dnsVerifier(dnsIntentBuilder(target.domain, domainState.dnsZoneFile));
  } catch (error) {
    return failure('dns_verification_failed', target, {
      dns_zone_file: domainState.dnsZoneFile,
      error_code: String(error?.message || 'dns_verification_failed').slice(0, 120),
    });
  }
  if (!dnsVerification.verified) {
    return failure('dns_pending', target, {
      dns: dnsVerification,
      dns_zone_file: domainState.dnsZoneFile,
      domain_ready: true,
    });
  }

  const password = generatedPassword();
  let mailboxState;
  try {
    mailboxState = await transport.createMailbox({
      domain: target.domain,
      mailbox: target.mailbox,
      password,
      displayName: displayName || `${target.platform} ${target.mailbox}`,
    });
  } catch (error) {
    return failure('mailbox_transport_failed', target, {
      error_code: String(error?.message || 'stalwart_mailbox_create_failed').slice(0, 120),
    });
  }

  if (!mailboxState.created) {
    return failure('credentials_recovery_required', target, {
      address: mailboxState.address,
      account_id: mailboxState.accountId,
      transport: 'stalwart-jmap',
      credentials_reissued: false,
    });
  }

  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  const safeName = mailboxState.address.replace(/[^a-z0-9._-]/gi, '_');
  const evidence = {
    schema_version: '1.1',
    logical_node_id: 'NODE01',
    identity_type: 'software-runtime',
    policy: 'owned-first',
    platform: target.platform,
    address: mailboxState.address,
    domain: target.domain,
    domain_id: mailboxState.domainId,
    account_id: mailboxState.accountId,
    transport: 'stalwart-jmap',
    state: 'mailbox_created_credentials_issued_once',
    password_stored: false,
    credentials_issued_once: true,
    dns_verified: true,
    created_at: new Date().toISOString(),
  };
  const evidencePath = resolve(evidenceDirectory, `mailbox-${safeName}.json`);
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });

  return {
    ok: true,
    state: 'mailbox_created_credentials_issued_once',
    created: true,
    address: mailboxState.address,
    platform: target.platform,
    domain: target.domain,
    transport: 'stalwart-jmap',
    credentials_issued_once: true,
    password,
    evidence_path: evidencePath,
  };
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
