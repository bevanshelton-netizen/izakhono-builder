import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile(new URL('./partner-registry.json', import.meta.url), 'utf8'));

test('partner registry has unique IDs and explicit non-production onboarding states', () => {
  const ids = registry.partners.map((partner) => partner.id);
  assert.equal(new Set(ids).size, ids.length, 'partner IDs must be unique');
  for (const partner of registry.partners) {
    assert.ok(partner.id && partner.name && partner.category);
    assert.ok(Array.isArray(partner.services) && partner.services.length > 0);
    assert.ok(['TARGET', 'CONTACTED', 'NDA', 'COMMERCIAL_REVIEW', 'TECHNICAL_REVIEW', 'COMPLIANCE', 'PILOT', 'ACCEPTED', 'PRODUCTION_ELIGIBLE', 'SUSPENDED'].includes(partner.onboardingStatus));
    assert.ok(partner.apiStatus);
    assert.ok(partner.provisioning);
  }
});

test('MTN and Telkom are recorded as contacted targets, not approved or integrated providers', () => {
  for (const id of ['mtn-business', 'telkom-business']) {
    const partner = registry.partners.find((candidate) => candidate.id === id);
    assert.ok(partner, `${id} must be present in the partner registry`);
    assert.equal(partner.onboardingStatus, 'CONTACTED');
    assert.equal(partner.apiStatus, 'commercial-assessment-required');
    assert.equal(partner.provisioning, 'partner-integration-required');
    assert.equal(partner.sla, 'to-negotiate');
    assert.equal(partner.pricing, 'wholesale-negotiation');
  }
});

test('registry explicitly requires documentary and technical evidence before production eligibility', () => {
  assert.match(registry.verificationRule, /executed commercial agreement/i);
  assert.match(registry.verificationRule, /technical acceptance/i);
  assert.match(registry.verificationRule, /compliance approval/i);
  assert.match(registry.verificationRule, /verified service evidence/i);
});
