import assert from 'node:assert/strict';
import { createProvisioningPlan, executeProvisioning } from './provisioning-orchestrator.mjs';

const plan = createProvisioningPlan({
  customerId: 'cust-test',
  serviceId: 'svc-test',
  product: 'I-CONNECT Mobile',
  requirements: { capabilities: ['voice', '5g', 'esim'] },
  telemetry: {
    'cellc-mvno': { ok: false },
    'vodacom-circles': { ok: true, coverage: 90, capacity: 80 }
  },
  maxAttempts: 2
});
assert.equal(plan.primaryProviderId, 'vodacom-circles');
assert.equal(plan.state, 'PLANNED');

const failoverPlan = createProvisioningPlan({
  customerId: 'cust-test',
  serviceId: 'svc-test-2',
  product: 'I-CONNECT Mobile',
  requirements: { capabilities: ['voice', '5g', 'esim'] },
  telemetry: { 'cellc-mvno': { ok: true }, 'vodacom-circles': { ok: true } },
  maxAttempts: 2
});

const result = await executeProvisioning({
  plan: failoverPlan,
  telemetry: { 'cellc-mvno': { ok: true }, 'vodacom-circles': { ok: true } },
  adapter: async ({ providerId, attempt }) => providerId === failoverPlan.primaryProviderId && attempt === 1
    ? { ok: false, error: 'simulated_provider_failure' }
    : { ok: true, externalReference: 'EXT-TEST-001' }
});

assert.equal(result.state, 'ACTIVE');
assert.equal(result.activeProviderId, 'vodacom-circles');
assert.equal(result.providerAttempts.length, 2);
assert.equal(result.providerAttempts[0].ok, false);
assert.equal(result.providerAttempts[1].ok, true);

const noAdapter = await executeProvisioning({ plan: failoverPlan });
assert.equal(noAdapter.state, 'PROVISIONING');
assert.equal(noAdapter.execution, 'adapter_required');

console.log('I-CONNECT provisioning orchestration tests passed');
