import fs from 'node:fs';
import path from 'node:path';

const manifestPath = process.argv[2] || new URL('../config/portfolio-identities.json', import.meta.url).pathname;
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const plan = [];
for (const identity of manifest.identities) {
  const domain = identity.domain;
  for (const localPart of identity.mailboxes) {
    plan.push({
      platform: identity.platform,
      address: domain ? `${localPart}@${domain}` : null,
      local_part: localPart,
      domain,
      action: domain ? 'ready_for_domain_validation' : 'awaiting_domain',
      secret_required: true,
      idempotency_key: `mailbox:${identity.platform}:${localPart}:${domain ?? 'pending'}`
    });
  }
}

const summary = {
  generated_by: 'NODE01',
  policy: manifest.policy,
  status: manifest.status,
  total_requested: plan.length,
  domain_ready: plan.filter(x => x.domain).length,
  awaiting_domain: plan.filter(x => !x.domain).length,
  rules: manifest.rules,
  plan
};

process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
