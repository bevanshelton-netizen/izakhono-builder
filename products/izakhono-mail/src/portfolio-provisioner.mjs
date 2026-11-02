import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { promises as dns } from 'node:dns';

const root = resolve(new URL('..', import.meta.url).pathname);
const manifestPath = process.env.NODE01_MAIL_MANIFEST || resolve(root, 'config/portfolio-identities.json');
const evidenceDir = process.env.NODE01_MAIL_EVIDENCE_DIR || resolve(root, 'evidence');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const validMailbox = value => /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value);
const validDomain = value => typeof value === 'string' && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);

async function inspectDomain(domain) {
  if (!validDomain(domain)) return { domain, status: 'invalid_domain' };
  try {
    const mx = await dns.resolveMx(domain);
    return { domain, status: mx.length ? 'mx_present' : 'mx_missing', mx: mx.sort((a,b)=>a.priority-b.priority).slice(0,10) };
  } catch (error) {
    return { domain, status: 'dns_unresolved', detail: String(error?.code || error?.message || error).slice(0,160) };
  }
}

const records = [];
for (const platform of manifest.identities || []) {
  const domain = platform.domain || null;
  if (!domain) {
    for (const mailbox of platform.mailboxes || []) records.push({ platform: platform.platform, mailbox, address: null, state: 'domain_required' });
    continue;
  }
  const domainCheck = await inspectDomain(domain);
  for (const mailbox of platform.mailboxes || []) {
    const address = validMailbox(mailbox) ? `${mailbox}@${domain}` : null;
    records.push({ platform: platform.platform, mailbox, address, state: address ? 'domain_checked' : 'invalid_mailbox', domain_check: domainCheck });
  }
}

const plan = {
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  controller: 'NODE01',
  policy: 'owned-first',
  external_fallback: true,
  never_claim_live: true,
  summary: {
    identities: records.length,
    domain_required: records.filter(r => r.state === 'domain_required').length,
    invalid: records.filter(r => r.state === 'invalid_mailbox' || r.state === 'invalid_domain').length,
    domains_checked: [...new Set(records.filter(r => r.domain_check).map(r => r.domain_check.domain))].length
  },
  next_actions: [
    'Register or assign verified domains for domain_required identities.',
    'Publish MX, SPF, DKIM and DMARC records through the owned DNS control plane.',
    'Provision mailbox credentials only in the runtime secret store; never commit passwords.',
    'Verify inbound/outbound SMTP before marking an identity active.'
  ],
  identities: records
};

mkdirSync(evidenceDir, { recursive: true });
const output = resolve(evidenceDir, 'portfolio-mail-provision-plan.json');
writeFileSync(output, JSON.stringify(plan, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ ok: true, output, summary: plan.summary }, null, 2));
