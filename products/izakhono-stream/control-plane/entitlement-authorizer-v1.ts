export type EntitlementStatus = 'ACTIVE' | 'REVOKED';

export interface EntitlementRecord {
  entitlementId: string;
  tenantId: string;
  userId: string;
  productId: string;
  status: EntitlementStatus;
  startsAt: string;
  endsAt?: string;
}

export interface EntitlementLookup {
  find(tenantId: string, userId: string, productId: string): Promise<EntitlementRecord | null>;
}

export interface EntitlementDecision {
  allowed: boolean;
  reason?: 'ENTITLEMENT_REQUIRED' | 'ENTITLEMENT_REVOKED' | 'ENTITLEMENT_NOT_STARTED' | 'ENTITLEMENT_EXPIRED';
  entitlementId?: string;
}

export async function authorizeEntitlement(
  lookup: EntitlementLookup,
  tenantId: string,
  userId: string,
  productId: string,
  now: string
): Promise<EntitlementDecision> {
  const entitlement = await lookup.find(tenantId, userId, productId);
  if (!entitlement) return { allowed: false, reason: 'ENTITLEMENT_REQUIRED' };
  if (entitlement.status !== 'ACTIVE') return { allowed: false, reason: 'ENTITLEMENT_REVOKED', entitlementId: entitlement.entitlementId };

  const at = new Date(now).getTime();
  const start = new Date(entitlement.startsAt).getTime();
  if (at < start) return { allowed: false, reason: 'ENTITLEMENT_NOT_STARTED', entitlementId: entitlement.entitlementId };

  if (entitlement.endsAt && at >= new Date(entitlement.endsAt).getTime()) {
    return { allowed: false, reason: 'ENTITLEMENT_EXPIRED', entitlementId: entitlement.entitlementId };
  }

  return { allowed: true, entitlementId: entitlement.entitlementId };
}
