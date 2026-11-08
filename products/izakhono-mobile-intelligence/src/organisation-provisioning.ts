import type { CustomerAuthDB, CustomerIdentity } from '../../../src/customer-auth';

type ProvisioningStatement = {
  bind(...values: unknown[]): ProvisioningStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export interface OrganisationProvisioningDB extends CustomerAuthDB {
  prepare(sql: string): ProvisioningStatement;
  batch(statements: ProvisioningStatement[]): Promise<unknown[]>;
}

/** Server-only authorization hook. A future internal admin route must supply this
 * from verified platform-admin credentials; never derive it from request JSON.
 */
export interface PlatformAdminAuthorizer {
  assertAuthorized(input: { actorCustomerId: string; operation: 'create_organisation_owner' }): Promise<void>;
}
export type OrganisationProvisioningResult = { organisationId: string; ownerCustomerId: string };

const randomHex = (length = 16) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

/** Provisions the first owner only after trusted platform-admin authorization.
 * No HTTP route is exposed by this module. Both customer and owner email must be
 * active/verified; organisation, owner membership and audit event are one D1 batch.
 */
export async function provisionOrganisationWithFirstOwner(
  db: OrganisationProvisioningDB,
  authorizer: PlatformAdminAuthorizer,
  platformAdmin: CustomerIdentity,
  owner: CustomerIdentity,
  organisationName: string,
  now = new Date(),
): Promise<OrganisationProvisioningResult> {
  await authorizer.assertAuthorized({
    actorCustomerId: platformAdmin.id,
    operation: 'create_organisation_owner',
  });
  if (platformAdmin.status !== 'active' || owner.status !== 'active') {
    throw new Error('Active platform administrator and owner identities are required.');
  }
  if (!owner.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email) || owner.email.length > 254) {
    throw new Error('A valid verified owner email is required.');
  }
  const name = organisationName.trim();
  if (!name || name.length > 120) throw new Error('Organisation name must be 1–120 characters.');
  const organisationId = 'org_' + randomHex();
  const membershipId = 'bom_' + randomHex();
  const eventId = 'bce_' + randomHex();
  const timestamp = now.toISOString();

  const createOrganisation = db.prepare(
    `INSERT INTO builder_organisations(id,name,status,created_by_customer_id,created_at,updated_at)
     SELECT ?,?,'active',id,?,? FROM builder_customers
     WHERE id=? AND status='active' AND email_verified_at IS NOT NULL`,
  ).bind(organisationId, name, timestamp, timestamp, owner.id);
  const createOwner = db.prepare(
    `INSERT INTO builder_organisation_memberships
     (id,organisation_id,customer_id,role,status,invited_by_customer_id,created_at,updated_at)
     SELECT ?,o.id,c.id,'owner','active',?,?,?
     FROM builder_organisations o JOIN builder_customers c ON c.id=?
     WHERE o.id=? AND o.status='active' AND c.status='active'
       AND c.email_verified_at IS NOT NULL`,
  ).bind(membershipId, platformAdmin.id, timestamp, timestamp, owner.id, organisationId);
  const audit = db.prepare(
    `INSERT INTO builder_customer_events(id,customer_id,event_type,detail,created_at)
     SELECT ?,?, 'mobile_org_first_owner_provisioned', ?, ?
     WHERE EXISTS (SELECT 1 FROM builder_organisation_memberships
       WHERE id=? AND organisation_id=? AND customer_id=? AND role='owner' AND status='active')`,
  ).bind(eventId, platformAdmin.id, JSON.stringify({ organisationId, ownerCustomerId: owner.id }), timestamp, membershipId, organisationId, owner.id);

  const results = await db.batch([createOrganisation, createOwner, audit]);
  const changes = results.map(result => (result as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 0);
  if (changes.some(count => count !== 1)) {
    throw new Error('Organisation provisioning was not completed; no owner access was granted.');
  }
  return { organisationId, ownerCustomerId: owner.id };
}
