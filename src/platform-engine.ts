export type TenantClass = "internal" | "external-independent";

export interface PlatformTenantManifest {
  schema_version: string;
  tenant_id: string;
  tenant_class: TenantClass;
  legal_entity: string;
  portfolio_owner: boolean;
  launch_state: string;
  engine: { independently_deployable: boolean; health_endpoint: string };
  isolation: Record<string, string>;
  capabilities: Record<string, boolean>;
  forbidden: string[];
}

const REQUIRED_ISOLATION = [
  "data", "auth", "storage", "secrets", "payments", "crm", "growth_contacts", "analytics"
] as const;

const REQUIRED_FORBIDDEN_EXTERNAL = [
  "cross_tenant_data_access",
  "cross_tenant_auth",
  "cross_tenant_payment_destination",
  "cross_tenant_growth_audience",
  "cross_tenant_consent_or_suppression",
  "shared_production_secrets"
] as const;

export function validateTenantManifest(m: PlatformTenantManifest): string[] {
  const errors: string[] = [];
  if (!/^[-a-z0-9]+$/.test(m.tenant_id || "")) errors.push("tenant_id must be lowercase slug");
  if (!m.legal_entity?.trim()) errors.push("legal_entity required");
  if (!m.engine?.independently_deployable) errors.push("engine must be independently deployable");
  if (!m.engine?.health_endpoint?.startsWith("/")) errors.push("health_endpoint must be absolute path");
  for (const key of REQUIRED_ISOLATION) {
    if (!m.isolation?.[key]) errors.push(`isolation.${key} required`);
  }
  if (m.tenant_class === "external-independent") {
    if (m.portfolio_owner) errors.push("external-independent tenant cannot be portfolio_owner");
    for (const rule of REQUIRED_FORBIDDEN_EXTERNAL) {
      if (!m.forbidden?.includes(rule)) errors.push(`external tenant missing forbidden rule: ${rule}`);
    }
  }
  return errors;
}

export function assertTenantBoundary(actor: PlatformTenantManifest, targetTenantId: string, resource: string): void {
  if (actor.tenant_id !== targetTenantId) {
    throw new Error(`TENANT_BOUNDARY_DENIED:${actor.tenant_id}:${targetTenantId}:${resource}`);
  }
}

export function canPubliclyPublish(m: PlatformTenantManifest): boolean {
  if (m.launch_state !== "live-verified") return false;
  return m.capabilities?.growth_engine === true;
}

export function scopedKey(m: PlatformTenantManifest, resource: string, id: string): string {
  assertTenantBoundary(m, m.tenant_id, resource);
  return `tenant/${m.tenant_id}/${resource}/${id}`;
}
