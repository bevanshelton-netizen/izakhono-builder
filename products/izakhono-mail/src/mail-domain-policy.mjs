import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const manifestPath = process.env.NODE01_MAIL_MANIFEST || resolve(root, 'config/portfolio-identities.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const normalise = value => String(value || '').trim().toLowerCase().replace(/\.$/, '');
const validDomain = value => typeof value === 'string' && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);

const entries = (manifest.identities || []).map(identity => ({
  ...identity,
  domain: identity.domain ? normalise(identity.domain) : null,
  mailboxes: new Set((identity.mailboxes || []).map(x => String(x).trim().toLowerCase()))
}));

export function identityForDomain(domain) {
  const canonical = normalise(domain);
  return entries.find(x => x.domain === canonical) || null;
}

export function identityForAddress(address) {
  const value = String(address || '').trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return null;
  return identityForDomain(value.slice(at + 1));
}

export function assertManagedAddress(address) {
  const value = String(address || '').trim().toLowerCase();
  const match = /^([^@\s]+)@([^@\s]+)$/.exec(value);
  if (!match) throw new Error('Valid mailbox address required');
  const [, local, domain] = match;
  if (!validDomain(domain)) throw new Error('Invalid mailbox domain');
  const identity = identityForDomain(domain);
  if (!identity) throw new Error(`Domain is not managed by NODE01: ${domain}`);
  if (!identity.mailboxes.has(local)) throw new Error(`Mailbox is not defined for ${identity.platform}: ${local}`);
  return { address: value, platform: identity.platform, domain, mailbox: local, identity };
}

export function assertProvisionTarget({ platform, mailbox }) {
  const requestedPlatform = String(platform || '').trim();
  const requestedMailbox = String(mailbox || '').trim().toLowerCase();
  const identity = entries.find(x => x.platform === requestedPlatform);
  if (!identity) throw new Error(`Unknown NODE01 platform: ${requestedPlatform}`);
  if (!identity.domain) return { platform: identity.platform, mailbox: requestedMailbox, domain: null, identity, state: 'domain_required' };
  if (!identity.mailboxes.has(requestedMailbox)) throw new Error(`Mailbox is not defined for ${identity.platform}: ${requestedMailbox}`);
  return { platform: identity.platform, mailbox: requestedMailbox, domain: identity.domain, identity, state: 'domain_verification_required' };
}

export function managedIdentities() {
  return entries.map(({ mailboxes, ...x }) => ({ ...x, mailboxes: [...mailboxes] }));
}
