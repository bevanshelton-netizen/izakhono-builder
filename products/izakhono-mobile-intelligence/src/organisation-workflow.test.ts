import assert from 'node:assert/strict';
import { createOrganisationInvitation, revokeOrganisationInvitation } from './organisation-workflow';
import type { OrganisationWorkflowDB } from './organisation-workflow';
import type { CustomerIdentity } from '../../../src/customer-auth';

function fakeDb(role: string, captured: unknown[][]): OrganisationWorkflowDB {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          captured.push(values);
          return {
            async first<T>() {
              if (sql.includes('FROM builder_organisation_memberships')) {
                return { organisation_id: 'org_123', organisation_name: 'Test Org', customer_id: 'cust_123', role } as T;
              }
              return null;
            },
            async run() { return { success: true }; },
          };
        },
      };
    },
    async batch() { return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }]; },
  } as unknown as OrganisationWorkflowDB;
}
const actor: CustomerIdentity = {
  id: 'cust_123', email: 'owner@example.org', display_name: 'Owner',
  organization: 'Legacy label', status: 'active',
};

async function run() {
  const writes: unknown[][] = [];
  const result = await createOrganisationInvitation(fakeDb('owner', writes), actor, 'org_123', 'person@example.org', 'member', new Date('2026-11-08T12:00:00Z'));
  assert.match(result.token, /^[a-f0-9]{64}$/);
  assert.equal(result.expiresAt, '2026-11-15T12:00:00.000Z');
  assert.equal(writes.length, 2);
  assert.notEqual(writes[1][4], result.token, 'database must receive a token digest, never the raw token');

  await assert.rejects(
    createOrganisationInvitation(fakeDb('member', []), actor, 'org_123', 'person@example.org', 'member'),
    /administrator access required/,
  );
  await assert.rejects(
    createOrganisationInvitation(fakeDb('owner', []), actor, 'org_123', 'person@example.org', 'owner' as 'member'),
    /Only admin or member invitations/,
  );
  await assert.rejects(
    createOrganisationInvitation(fakeDb('owner', []), { ...actor, status: 'suspended' }, 'org_123', 'person@example.org', 'member'),
    /Invalid invitation request/,
  );
  const revoked = await revokeOrganisationInvitation(fakeDb('admin', []), actor, 'org_123', 'boi_0123456789abcdef0123456789abcdef', new Date('2026-11-08T12:00:00Z'));
  assert.equal(revoked, true);
  await assert.rejects(
    revokeOrganisationInvitation(fakeDb('member', []), actor, 'org_123', 'boi_0123456789abcdef0123456789abcdef'),
    /administrator access required/,
  );
  assert.equal(await revokeOrganisationInvitation(fakeDb('owner', []), actor, 'org_123', 'invalid'), false);
  console.log('IZAKHONO organisation invitation workflow tests passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
