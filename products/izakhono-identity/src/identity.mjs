import crypto from 'node:crypto';

const DOMAIN = process.env.IZAKHONO_IDENTITY_DOMAIN || 'izakhono';
const ADDRESS_RE = new RegExp(`^([^@\\s]+)@${DOMAIN.replace('.', '\\.')}$`, 'i');
const identities = new Map();

export function normalizeAddress(address) {
  if (typeof address !== 'string') throw new Error('invalid_address');
  const normalized = address.trim().toLowerCase();
  if (!ADDRESS_RE.test(normalized)) throw new Error('invalid_izakhono_identity');
  return normalized;
}

export function createIdentity(address, profile = {}) {
  const canonical = normalizeAddress(address);
  const existing = identities.get(canonical);
  if (existing) return existing;

  const identity = {
    address: canonical,
    namespace: DOMAIN,
    displayName: String(profile.displayName || canonical.split('@')[0]),
    role: profile.role || 'user',
    status: 'active',
    mailbox: canonical,
    createdAt: new Date().toISOString(),
    identityId: crypto.randomUUID()
  };

  identities.set(canonical, identity);
  return identity;
}

export function ensureIdentity(address, profile = {}) {
  return createIdentity(address, profile);
}

export function getIdentity(address) {
  const canonical = normalizeAddress(address);
  return identities.get(canonical) || null;
}

export function validateIdentity(address) {
  const canonical = normalizeAddress(address);
  return {
    valid: true,
    address: canonical,
    exists: identities.has(canonical),
    namespace: DOMAIN
  };
}

export function setIdentityStatus(address, status) {
  const identity = getIdentity(address);
  if (!identity) throw new Error('identity_not_found');
  if (!['active', 'suspended', 'disabled'].includes(status)) throw new Error('invalid_status');
  identity.status = status;
  return identity;
}

export function listIdentities() {
  return [...identities.values()];
}
