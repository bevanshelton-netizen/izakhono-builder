import type { AccessDecision, ConsentGrant, DataDomain, Permission } from './types.js';

const restrictedDomains = new Set<DataDomain>(['identity', 'payments', 'location']);

export function decideAccess(
  grant: ConsentGrant | undefined,
  requestedPermission: Permission,
  requestedDomain: DataDomain,
  now = new Date(),
): AccessDecision {
  if (!grant) {
    return { allowed: false, reason: 'No user consent grant exists', requiresConsent: true };
  }
  if (grant.revokedAt) {
    return { allowed: false, reason: 'User consent has been revoked', requiresConsent: true };
  }
  if (grant.expiresAt && new Date(grant.expiresAt) <= now) {
    return { allowed: false, reason: 'User consent has expired', requiresConsent: true };
  }
  if (!grant.permissions.includes(requestedPermission)) {
    return { allowed: false, reason: 'Requested permission is outside the granted scope', requiresConsent: true };
  }
  if (!grant.dataDomains.includes(requestedDomain)) {
    return { allowed: false, reason: 'Requested data domain is outside the granted scope', requiresConsent: true };
  }
  if (restrictedDomains.has(requestedDomain) && grant.dataDomains.length > 1 && !grant.permissions.includes(requestedPermission)) {
    return { allowed: false, reason: 'Restricted domain requires explicit scoped permission', requiresConsent: true };
  }
  return { allowed: true, reason: 'Explicit scoped consent matched', requiresConsent: false };
}

export function privacyDefaults() {
  return {
    dataMinimisation: true,
    encryptionAtRest: true,
    encryptionInTransit: true,
    silentCrossServiceTracking: false,
    behaviouralProfiling: false,
    advertisingIds: false,
    aiTrainingFromPrivateData: false,
    thirdPartyDefaultAccess: false,
    exportEnabled: true,
    deletionRequestsEnabled: true,
    auditTrailEnabled: true,
    zeroTrust: true,
  } as const;
}
