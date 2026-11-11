export type MonetisationModel = "FREE" | "SVOD" | "TVOD" | "PPV" | "AVOD" | "FAST" | "HYBRID";

export interface Plan {
  id: string;
  model: MonetisationModel;
  currency: string;
  priceMinor: number;
  active: boolean;
  entitlementIds: string[];
}

export interface Entitlement {
  id: string;
  userId: string;
  tenantId: string;
  planId?: string;
  assetIds: string[];
  channelIds?: string[];
  startsAt?: string;
  endsAt?: string;
  revoked?: boolean;
}

export interface PlaybackAccessRequest {
  tenantId: string;
  userId: string;
  assetId: string;
  planId?: string;
  now?: string;
}

export interface PlaybackAccessResult {
  allowed: boolean;
  reason?:
    | "FREE_ACCESS"
    | "ENTITLED"
    | "PLAN_REQUIRED"
    | "PLAN_INACTIVE"
    | "ENTITLEMENT_MISSING"
    | "RIGHTS_WINDOW_CLOSED"
    | "ENTITLEMENT_REVOKED";
  entitlementId?: string;
}

function inWindow(now: number, startsAt?: string, endsAt?: string): boolean {
  if (startsAt && now < Date.parse(startsAt)) return false;
  if (endsAt && now >= Date.parse(endsAt)) return false;
  return true;
}

export function authorizePlaybackAccess(
  request: PlaybackAccessRequest,
  plans: Plan[],
  entitlements: Entitlement[],
  assetRights?: { startsAt?: string; endsAt?: string },
): PlaybackAccessResult {
  const now = Date.parse(request.now ?? new Date().toISOString());

  if (!inWindow(now, assetRights?.startsAt, assetRights?.endsAt)) {
    return { allowed: false, reason: "RIGHTS_WINDOW_CLOSED" };
  }

  if (!request.planId) {
    const free = plans.find((plan) => plan.model === "FREE" && plan.active);
    if (free) return { allowed: true, reason: "FREE_ACCESS" };
    return { allowed: false, reason: "PLAN_REQUIRED" };
  }

  const plan = plans.find((candidate) => candidate.id === request.planId);
  if (!plan || !plan.active) return { allowed: false, reason: "PLAN_INACTIVE" };

  const entitlement = entitlements.find(
    (candidate) =>
      candidate.tenantId === request.tenantId &&
      candidate.userId === request.userId &&
      candidate.planId === plan.id &&
      candidate.assetIds.includes(request.assetId),
  );

  if (!entitlement) return { allowed: false, reason: "ENTITLEMENT_MISSING" };
  if (entitlement.revoked) return { allowed: false, reason: "ENTITLEMENT_REVOKED" };
  if (!inWindow(now, entitlement.startsAt, entitlement.endsAt)) {
    return { allowed: false, reason: "RIGHTS_WINDOW_CLOSED" };
  }

  return { allowed: true, reason: "ENTITLED", entitlementId: entitlement.id };
}
