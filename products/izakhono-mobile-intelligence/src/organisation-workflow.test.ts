import assert from 'node:assert/strict';
import { createOrganisationInvitation, acceptOrganisationInvitation } from './organisation-workflow';

function run() {
  assert.equal(typeof createOrganisationInvitation, 'function');
  assert.equal(typeof acceptOrganisationInvitation, 'function');
  // Static security invariants: invitation role type excludes owner and token is hashed before persistence.
  const source = String(createOrganisationInvitation);
  assert.ok(source.includes('sha256(token)'));
  assert.ok(source.includes("role !== 'admin' && role !== 'member'"));
  assert.ok(!source.includes("role: 'owner'"));
  console.log('IZAKHONO organisation invitation workflow contract tests passed');
}
run();
