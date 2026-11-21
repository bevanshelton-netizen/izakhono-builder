import { promises as dns } from 'node:dns';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const manifestPath = process.env.NODE01_MAIL_MANIFEST || resolve(root, 'config/portfolio-identities.json');
const evidenceDir = process.env.NODE01_MAIL_EVIDENCE_DIR || resolve(root, 'evidence');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const validDomain = value => typeof value === 'string' && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
const normalise = value => String(value || '').trim().toLowerCase().replace(/\.$/, '');
const txt = values => (values || []).flat().join('');

function envRecord(domain) {
  const prefix = domain.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return {
    mxHost: process.env[`NODE01_MAIL_MX_HOST_${prefix}`] || process.env.NODE01_MAIL_MX_HOST || '',
    spfInclude: process.env[`NODE01_MAIL_SPF_INCLUDE_${prefix}`] || process.env.NODE01_MAIL_SPF_INCLUDE || '',
    spfIp4: process.env[`NODE01_MAIL_SPF_IP4_${prefix}`] || process.env.NODE01_MAIL_SPF_IP4 || '',
    dkimSelector: process.env[`NODE01_MAIL_DKIM_SELECTOR_${prefix}`] || process.env.NODE01_MAIL_DKIM_SELECTOR || '',
    dkimPublicKey: process.env[`NODE01_MAIL_DKIM_PUBLIC_KEY_${prefix}`] || process.env.NODE01_MAIL_DKIM_PUBLIC_KEY || '',
    dmarcPolicy: process.env[`NODE01_MAIL_DMARC_POLICY_${prefix}`] || process.env.NODE01_MAIL_DMARC_POLICY || 'none',
    dmarcRua: process.env[`NODE01_MAIL_DMARC_RUA_${prefix}`] || process.env.NODE01_MAIL_DMARC_RUA || ''
  };
}

export function buildDnsIntent(domain) {
  if (!validDomain(domain)) return { domain, status: 'invalid_domain', records: [] };
  const cfg = envRecord(domain);
  const records = [];
  if (cfg.mxHost) records.push({ type: 'MX', name: '@', value: normalise(cfg.mxHost), priority: 10, status: 'ready' });
  else records.push({ type: 'MX', name: '@', value: null, status: 'mail_host_required' });

  const spfParts = ['v=spf1'];
  if (cfg.spfInclude) spfParts.push(`include:${normalise(cfg.spfInclude)}`);
  if (cfg.spfIp4) spfParts.push(...cfg.spfIp4.split(',').map(v => v.trim()).filter(Boolean).map(v => `ip4:${v}`));
  spfParts.push('~all');
  records.push({ type: 'TXT', name: '@', purpose: 'SPF', value: spfParts.join(' '), status: cfg.spfInclude || cfg.spfIp4 ? 'ready' : 'sender_authorization_required' });

  if (cfg.dkimSelector && cfg.dkimPublicKey) {
    records.push({ type: 'TXT', name: `${cfg.dkimSelector}._domainkey`, purpose: 'DKIM', value: `v=DKIM1; k=rsa; p=${cfg.dkimPublicKey.replace(/^\"|\"$/g, '')}`, status: 'ready' });
  } else {
    records.push({ type: 'TXT', name: cfg.dkimSelector ? `${cfg.dkimSelector}._domainkey` : null, purpose: 'DKIM', value: null, status: 'dkim_key_required' });
  }

  const dmarc = [`v=DMARC1`, `p=${cfg.dmarcPolicy}`];
  if (cfg.dmarcRua) dmarc.push(`rua=mailto:${cfg.dmarcRua}`);
  records.push({ type: 'TXT', name: '_dmarc', purpose: 'DMARC', value: dmarc.join('; '), status: cfg.dmarcRua ? 'ready' : 'reporting_mailbox_optional' });

  const blocking = records.filter(r => ['mail_host_required', 'sender_authorization_required', 'dkim_key_required'].includes(r.status));
  return { domain, status: blocking.length ? 'dns_pending' : 'dns_ready_for_verification', records };
}

async function resolveTxt(name) {
  try { return (await dns.resolveTxt(name)).map(txt); } catch { return []; }
}

export async function verifyDnsIntent(intent) {
  if (!validDomain(intent.domain)) return { domain: intent.domain, status: 'invalid_domain', checks: [] };
  const checks = [];
  for (const record of intent.records) {
    if (!record.value) {
      checks.push({ ...record, verified: false, reason: record.status });
      continue;
    }
    try {
      if (record.type === 'MX') {
        const actual = await dns.resolveMx(intent.domain);
        const verified = actual.some(x => normalise(x.exchange) === normalise(record.value) && x.priority === record.priority);
        checks.push({ ...record, verified, actual: actual.slice(0, 10) });
      } else {
        const name = record.name === '@' ? intent.domain : `${record.name}.${intent.domain}`;
        const actual = await resolveTxt(name);
        checks.push({ ...record, verified: actual.includes(record.value), actual: actual.slice(0, 10) });
      }
    } catch (error) {
      checks.push({ ...record, verified: false, reason: String(error?.code || error?.message || error).slice(0, 160) });
    }
  }
  const verified = checks.length > 0 && checks.every(x => x.verified);
  return { domain: intent.domain, status: verified ? 'dns_verified' : 'dns_pending', verified, checks };
}

export async function run() {
  const domains = [...new Set((manifest.identities || []).map(x => x.domain).filter(Boolean))];
  const intents = domains.map(buildDnsIntent);
  const verifications = [];
  for (const intent of intents) verifications.push(await verifyDnsIntent(intent));
  const result = {
    schema_version: '1.0', controller: 'NODE01', policy: 'owned-first',
    generated_at: new Date().toISOString(), live_mutation: false,
    domains: intents.map((intent, i) => ({ intent, verification: verifications[i] })),
    next_state: verifications.length && verifications.every(v => v.verified) ? 'ready_for_mailbox_provisioning' : 'dns_pending'
  };
  mkdirSync(evidenceDir, { recursive: true });
  const output = resolve(evidenceDir, 'dns-control-evidence.json');
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, output, next_state: result.next_state, domains: result.domains.length }, null, 2));
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) await run();
