export type Role = "OWNER" | "ADMIN" | "AGENT" | "READ_ONLY";

export type Principal = {
  userId: string;
  tenantId: string;
  role: Role;
};

const permissions: Record<Role, ReadonlySet<string>> = {
  OWNER: new Set(["read", "write", "provision", "admin"]),
  ADMIN: new Set(["read", "write", "provision", "admin"]),
  AGENT: new Set(["read", "write"]),
  READ_ONLY: new Set(["read"]),
};

export function authorize(principal: Principal | undefined, tenantId: string, permission: string): void {
  if (!principal) throw new Error("unauthenticated");
  if (!principal.tenantId || principal.tenantId !== tenantId) throw new Error("tenant_scope_violation");
  if (!permissions[principal.role].has(permission)) throw new Error("forbidden");
}
