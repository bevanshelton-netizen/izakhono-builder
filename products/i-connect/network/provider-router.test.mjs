import assert from 'node:assert/strict';
import { failover, listProviders, selectProvider } from './provider-router.mjs';

assert.equal(listProviders().length, 7);

const mobile = selectProvider({
  requirements: { capabilities: ['5g', 'esim'] },
  telemetry: {
    'cellc-mvno': { ok: true, latencyMs: 40, coverage: 90, capacity: 80, commercialScore: 70, costScore: 80 },
    'vodacom-circles': { ok: true, latencyMs: 30, coverage: 95, capacity: 90, commercialScore: 80, costScore: 70 }
  }
});
assert.equal(mobile.selected.id, 'vodacom-circles');

const failed = selectProvider({
  requirements: { capabilities: ['fibre'] },
  telemetry: { afrinet: { ok: false }, openserve: { ok: true, latencyMs: 20, coverage: 90, capacity: 90, commercialScore: 80, costScore: 80 } }
});
assert.equal(failed.selected.id, 'openserve');

const switched = failover({
  currentProviderId: 'cellc-mvno',
  requirements: { capabilities: ['5g', 'esim'] },
  telemetry: { 'cellc-mvno': { ok: false }, 'vodacom-circles': { ok: true } }
});
assert.equal(switched.selected.id, 'vodacom-circles');
assert.equal(switched.from, 'cellc-mvno');

assert.throws(() => selectProvider({ requirements: { capabilities: ['does-not-exist'] } }), /no_eligible_network_provider/);
console.log('[PASS] I-CONNECT provider selection and failover contract.');
