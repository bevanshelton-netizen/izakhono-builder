import type { CustomerAuthDB, CustomerIdentity } from '../../../src/customer-auth';

export type OrganisationRole = 'owner' | 'admin' | 'member';

export type OrganisationAccess = {
  organisationId: string;
  organisationName: string;
  customerId: string;
  role: OrganisationRole;
};

type MembershipRow = {
  organisation_id: string;
  organisation_name: string;
  customer_id: string;
  role: OrganisationRole;
};

/**
 * Resolves tenant access exclusively from an active, explicit membership row.
 * The legacy customer.organization string is display-only and is never queried.
 */
export async function resolveOrganisationAccess(
  db: CustomerAuthDB,
  identity: CustomerIdentity,
  requestedOrganisationId: string,
): Promise<OrganisationAccess | null> {
  if (identity.status !== 'active') return null;
  if (!requestedOrganisationId || requestedOrganisationId.length > 128) return null;

  const row = await db.prepare(
    `SELECT o.id AS organisation_id,o.name AS organisation_name,
            m.customer_id,m.role
     FROM builder_organisation_memberships m
     JOIN builder_organisations o ON o.id=m.organisation_id
     JOIN builder_customers c ON c.id=m.customer_id
     WHERE m.organisation_id=?
       AND m.customer_id=?
       AND m.status='active'
       AND o.status='active'
       AND c.status='active'
     LIMIT 1`,
  ).bind(requestedOrganisationId, identity.id).first<MembershipRow>();

  if (!row) return null;
  if (!['owner', 'admin', 'member'].includes(row.role)) return null;
  return {
    organisationId: row.organisation_id,
    organisationName: row.organisation_name,
    customerId: row.customer_id,
    role: row.role,
  };
}
