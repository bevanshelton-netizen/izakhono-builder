#!/usr/bin/env node
import fs from 'node:fs/promises';

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('Usage: node provision-customer.mjs <manifest.json> [--apply]');
  process.exit(2);
}

const apply = process.argv.includes('--apply');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const nodeUrl = (process.env.NODE01_URL || 'http://127.0.0.1:8940').replace(/\/$/, '');
const token = process.env.NODE01_TOKEN || '';

function assertSafe(value, name) {
  if (!value || typeof value !== 'string') throw new Error(`${name} is required`);
}

assertSafe(manifest.customer_id, 'customer_id');
if (!Array.isArray(manifest.sites) || manifest.sites.length === 0) throw new Error('sites are required');
if (!Array.isArray(manifest.content) || manifest.content.length === 0) throw new Error('content is required');

const sourceBase = `https://raw.githubusercontent.com/${manifest.source.repository}/${manifest.source.ref}/`;
const files = {};
for (const item of manifest.content) {
  if (!/^[-a-zA-Z0-9_./]+$/.test(item.path) || item.path.includes('..')) throw new Error(`unsafe content path: ${item.path}`);
  const response = await fetch(new URL(item.source_path, sourceBase));
  if (!response.ok) throw new Error(`source fetch failed: ${item.source_path} (${response.status})`);
  files[item.path] = await response.text();
}

const plan = {
  customer_id: manifest.customer_id,
  source_ref: `${manifest.source.repository}@${manifest.source.ref}:${manifest.source.path}`,
  sites: manifest.sites.map(({ site_id, domain, canonical }) => ({ site_id, domain, canonical: !!canonical })),
  content_files: Object.keys(files),
  acceptance: manifest.promotion
};

console.log(JSON.stringify({ mode: apply ? 'apply' : 'plan', ...plan }, null, 2));
if (!apply) process.exit(0);
if (!token) throw new Error('NODE01_TOKEN is required for --apply');

async function nodeJob(type, site) {
  const response = await fetch(`${nodeUrl}/v1/jobs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      type,
      provider_id: 'izakhono-host',
      payload: {
        domain: site.domain,
        site_id: site.site_id,
        source_ref: plan.source_ref,
        files
      }
    })
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${type} failed for ${site.domain}: HTTP ${response.status} ${body}`);
  return JSON.parse(body);
}

for (const site of manifest.sites) {
  const provision = await nodeJob('PROVISION', site);
  console.log(JSON.stringify({ stage: 'provisioned', domain: site.domain, job: provision.id || provision.job_id || provision }, null, 2));

  const deploy = await nodeJob('DEPLOY', site);
  console.log(JSON.stringify({ stage: 'content_deployed', domain: site.domain, job: deploy.id || deploy.job_id || deploy }, null, 2));
}

console.log(JSON.stringify({
  customer_id: manifest.customer_id,
  result: 'PROVISIONED_CONTENT_READY',
  public_live: false,
  reason: 'DNS, trusted HTTPS and content acceptance evidence are still required before promotion.'
}, null, 2));
