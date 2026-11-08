import assert from 'node:assert/strict';
import { provisionOrganisationWithFirstOwner } from './organisation-provisioning';
import type { OrganisationProvisioningDB } from './organisation-provisioning';
import type { CustomerIdentity } from '../../../src/customer-auth';

const identity = (id: string): CustomerIdentity => ({
  id, email: id + '@example.org', display_name: id, organization: 'legacy display label',
  status: 'active',
});
function dbWith(changes: number[]): OrganisationProvisioningDB {
  return {
    prepare() { return { bind() { return { first: async () => null, run: async () => ({}) }; } }; },
    async batch() { return changes.map(count => ({ meta: { changes: count } })); },
  } as unknown as OrganisationProvisioningDB;
}
async function run() {
  let authorized = 0;
  const authorizer = { async assertAuthorized() { authorized += 1; } };
  const result = await provisionOrganisationWithFirstOwner(
    dbWith([1, 1]), authorizer, identity('platform-admin'), identity('first-owner'),
    'Izakhono Customer', new Date('2026-11-08T12:00:00Z'),
  );
  assert.match(result.organisationId, /^org_[a-f0-9]{32}$/);
  assert.equal(result.ownerCustomerId, 'first-owner');
  assert.equal(authorized, 1);

  await assert.rejects(
    provisionOrganisationWithFirstOwner(dbWith([1, 1, 1]), { async assertAuthorized() { throw new Error('forbidden'); } },
      identity('untrusted'), identity('first-owner'), 'Blocked Org'),
    /forbidden/,
  );
  await assert.rejects(
    provisionOrganisationWithFirstOwner(dbWith([1, 0]), authorizer, identity('platform-admin'),
      identity('first-owner'), 'Partial Org'),
    /not completed/,
  );
  await assert.rejects(
    provisionOrganisationWithFirstOwner(dbWith([1, 1, 1]), authorizer, identity('platform-admin'),
      { ...identity('first-owner'), status: 'pending_verification' }, 'Unverified Owner'),
    /Active platform administrator and owner identities/,
  );
  console.log('IZAKHONO first-owner provisioning tests passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
