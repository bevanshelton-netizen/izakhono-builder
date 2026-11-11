import assert from 'node:assert/strict';
import { evaluateActivation, assertProviderNeutral } from './control-plane-state.mjs';

const base = {
  target: { nodeId: 'CONTABO-VPS-01', provider: 'contabo', routeClass: 'external-resilience' },
  evidence: {
    releaseApproved: true,
    health: true,
    deployment: true,
    edge: true,
    tls: true,
    dns: true,
    smokeTest: true,
    rollbackReady: true
  }
};

assertProviderNeutral(base);
assert.equal(evaluateActivation(base).state, 'LIVE_VERIFIED');

const missingTls = structuredClone(base);
missingTls.evidence.tls = false;
assert.equal(evaluateActivation(missingTls).state, 'DEGRADED');
assert.ok(evaluateActivation(missingTls).missing.includes('tls'));

const failed = structuredClone(base);
failed.evidence.health = false;
assert.equal(evaluateActivation(failed).state, 'FAILED');

assert.throws(() => assertProviderNeutral({
  target: { nodeId: 'X', provider: 'x', routeClass: 'unknown' }
}));

console.log('Runtime control-plane state tests: PASS');
