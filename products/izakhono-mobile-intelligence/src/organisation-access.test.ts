import { strict as assert } from 'node:assert';
import { resolveOrganisationAccess } from './organisation-access';

const identity = {
  id: 'customer-1',
  email: 'member@example.test',
  display_name: 'Member',
  organization: 'Display-only legacy organisation',
  status: 'active',
};

function mockDb(row: unknown) {
  let sql = '';
  let values: unknown[] = [];
  return {
    db: {
      prepare(statement: string) {
        sql = statement;
        return {
          bind(...bound: unknown[]) {
            values = bound;
            return { first: async () => row };
          },
        };
      },
    } as never,
    inspect: () => ({ sql, values }),
  };
}

async function run() {
  const allowed = mockDb({
    organisation_id: 'org-verified',
    organisation_name: 'Verified Organisation',
    customer_id: 'customer-1',
    role: 'admin',
  });
  const access = await resolveOrganisationAccess(allowed.db, identity, 'org-verified');
  assert.deepEqual(access, {
    organisationId: 'org-verified',
    organisationName: 'Verified Organisation',
    customerId: 'customer-1',
    role: 'admin',
  });
  assert.match(allowed.inspect().sql, /m\.status='active'/);
  assert.match(allowed.inspect().sql, /o\.status='active'/);
  assert.match(allowed.inspect().sql, /c\.status='active'/);
  assert.deepEqual(allowed.inspect().values, ['org-verified', 'customer-1']);
  assert.doesNotMatch(allowed.inspect().sql, /c\.organization\s*=/);

  const noMembership = mockDb(null);
  assert.equal(await resolveOrganisationAccess(noMembership.db, identity, 'legacy-display-name'), null);

  const suspended = mockDb({
    organisation_id: 'org-verified',
    organisation_name: 'Verified Organisation',
    customer_id: 'customer-1',
    role: 'owner',
  });
  assert.equal(await resolveOrganisationAccess(suspended.db, { ...identity, status: 'suspended' }, 'org-verified'), null);
  assert.equal(await resolveOrganisationAccess(suspended.db, identity, ''), null);
  assert.equal(await resolveOrganisationAccess(suspended.db, identity, 'x'.repeat(129)), null);

  const malformedRole = mockDb({
    organisation_id: 'org-verified',
    organisation_name: 'Verified Organisation',
    customer_id: 'customer-1',
    role: 'superuser',
  });
  assert.equal(await resolveOrganisationAccess(malformedRole.db, identity, 'org-verified'), null);
  console.log('Mobile organisation access tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
