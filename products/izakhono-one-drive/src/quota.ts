export const DEFAULT_SPACE_QUOTA_BYTES = 50n * 1024n * 1024n * 1024n;
export type SpaceKind = "personal" | "business";
export type MembershipRole = "owner" | "admin" | "editor" | "viewer";
export interface SpaceQuota { quotaBytes: bigint; usedBytes: bigint; reservedBytes: bigint }
export interface Principal { userId: string; organisationIds: ReadonlySet<string> }
export interface SpaceAccess { kind: SpaceKind; ownerUserId?: string; organisationId?: string; role?: MembershipRole }

export function remainingBytes(q: SpaceQuota): bigint { assertQuota(q); return q.quotaBytes-q.usedBytes-q.reservedBytes; }
export function assertQuota(q: SpaceQuota): void {
 if(q.quotaBytes<=0n||q.usedBytes<0n||q.reservedBytes<0n) throw new RangeError("invalid-quota-values");
 if(q.usedBytes+q.reservedBytes>q.quotaBytes) throw new RangeError("quota-invariant-violated");
}
export function canAccessSpace(p: Principal,s: SpaceAccess): boolean {
 if(s.kind==="personal") return Boolean(s.ownerUserId)&&s.ownerUserId===p.userId;
 return Boolean(s.organisationId)&&p.organisationIds.has(s.organisationId)&&Boolean(s.role);
}
export function canMutateFiles(role: MembershipRole|undefined): boolean { return role==="owner"||role==="admin"||role==="editor"; }
export function reserveUpload(q: SpaceQuota,n: bigint): SpaceQuota {
 assertQuota(q); if(n<=0n) throw new RangeError("upload-size-must-be-positive");
 if(n>remainingBytes(q)) throw new RangeError("quota-exceeded");
 return {...q,reservedBytes:q.reservedBytes+n};
}
export function commitUpload(q: SpaceQuota,reserved: bigint,actual: bigint): SpaceQuota {
 assertQuota(q); if(reserved<=0n||actual<0n||reserved>q.reservedBytes) throw new RangeError("invalid-reservation-transition");
 if(actual>reserved) throw new RangeError("upload-exceeds-reservation");
 const next={...q,reservedBytes:q.reservedBytes-reserved,usedBytes:q.usedBytes+actual}; assertQuota(next); return next;
}
export function releaseReservation(q: SpaceQuota,n: bigint): SpaceQuota {
 assertQuota(q); if(n<=0n||n>q.reservedBytes) throw new RangeError("invalid-reservation-release");
 return {...q,reservedBytes:q.reservedBytes-n};
}
