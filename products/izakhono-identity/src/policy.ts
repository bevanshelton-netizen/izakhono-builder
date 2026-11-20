import type { Principal, VerificationPurpose } from "./types.js";

export type Permission =
  | "identity:verify:create"
  | "identity:verify:read"
  | "identity:verify:review"
  | "identity:tenant:admin";

export class AccessDeniedError extends Error {
  constructor(message = "Access denied") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export function requireTenantPermission(
  principal: Principal,
  tenantId: string,
  permission: Permission,
): void {
  if (!principal.userId) throw new AccessDeniedError();
  if (principal.roles.includes("izakhono_owner")) return;

  const membership = principal.tenantMemberships.find(
    (item) => item.tenantId === tenantId && item.status === "active",
  );
  if (!membership || !membership.permissions.includes(permission)) {
    throw new AccessDeniedError("The principal lacks the required tenant permission");
  }
}

export function validatePurpose(purpose: VerificationPurpose): void {
  const allowed: VerificationPurpose[] = [
    "customer_onboarding",
    "business_onboarding",
    "employment",
    "supplier_onboarding",
    "account_recovery",
    "regulated_service",
  ];
  if (!allowed.includes(purpose)) throw new AccessDeniedError("Unsupported verification purpose");
}
