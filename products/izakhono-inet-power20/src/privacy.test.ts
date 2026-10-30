import assert from 'node:assert/strict';
import { decideAccess, privacyDefaults } from './privacy.js';

const now = new Date('2026-10-30T00:00:00.000Z');
const grant = {
  subjectId: 'user-1',
  serviceId: 'mail',
  permissions: ['read:mail', 'send:mail'] as const,
  dataDomains: ['communications'] as const,
  grantedAt: now.toISOString(),
};

assert.equal(decideAccess(grant, 'read:mail', 'communications', now).allowed, true);
assert.equal(decideAccess(grant, 'read:files', 'communications', now).allowed, false);
assert.equal(decideAccess(undefined, 'read:mail', 'communications', now).requiresConsent, true);
assert.equal(decideAccess({ ...grant, revokedAt: now.toISOString() }, 'read:mail', 'communications', now).allowed, false);
assert.equal(decideAccess({ ...grant, expiresAt: '2026-10-29T00:00:00.000Z' }, 'read:mail', 'communications', now).allowed, false);

const defaults = privacyDefaults();
assert.equal(defaults.silentCrossServiceTracking, false);
assert.equal(defaults.behaviouralProfiling, false);
assert.equal(defaults.advertisingIds, false);
assert.equal(defaults.aiTrainingFromPrivateData, false);
assert.equal(defaults.zeroTrust, true);

console.log('I-NET POWER 20 privacy tests passed');
