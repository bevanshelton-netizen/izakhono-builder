export type FortressRole = 'OWNER' | 'SECURITY_ADMIN' | 'ANALYST' | 'VIEWER';

export interface FortressPrincipal {
  id: string;
  tenantId: string;
  role: FortressRole;
  active: boolean;
}

const permissions: Record<FortressRole, ReadonlySet<string>> = {
  OWNER: new Set(['asset:read','asset:write','scan:run','finding:read','finding:write','remediation:write','evidence:read','admin:access']),
  SECURITY_ADMIN: new Set(['asset:read','asset:write','scan:run','finding:read','finding:write','remediation:write','evidence:read']),
  ANALYST: new Set(['asset:read','scan:run','finding:read','finding:write','remediation:write','evidence:read']),
  VIEWER: new Set(['asset:read','finding:read','evidence:read'])
};

export function assertActive(principal: FortressPrincipal): void {
  if (!principal.active) throw new Error('FORTRESS access denied: principal is inactive.');
  if (!principal.id.trim() || !principal.tenantId.trim()) throw new Error('FORTRESS access denied: principal identity is incomplete.');
}

export function can(principal: FortressPrincipal, permission: string): boolean {
  assertActive(principal);
  return permissions[principal.role].has(permission);
}

export function assertPermission(principal: FortressPrincipal, permission: string): void {
  if (!can(principal, permission)) throw new Error(`FORTRESS access denied: role ${principal.role} lacks ${permission}.`);
}

export function assertTenant(principal: FortressPrincipal, tenantId: string): void {
  assertActive(principal);
  if (principal.tenantId !== tenantId) throw new Error('FORTRESS access denied: cross-tenant access is prohibited.');
}

export function authorize(principal: FortressPrincipal, tenantId: string, permission: string): void {
  assertTenant(principal, tenantId);
  assertPermission(principal, permission);
}
