const test = require('node:test');
const assert = require('node:assert/strict');
const { getReadiness } = require('./readiness');

test('missing integrations keep production readiness blocked', () => {
  const result = getReadiness({});
  assert.equal(result.productionReady, false);
  assert.equal(result.body.status, 'activation_required');
  assert.equal(result.body.safeguards.pstnLive, false);
  assert.equal(result.body.safeguards.realBilling, false);
  assert.deepEqual(result.body.missing, [
    'supabaseUrl',
    'supabaseAnonKey',
    'carrierBridgeUrl',
    'carrierBridgeSecret',
    'paymentProvider'
  ]);
});

test('partial carrier credentials do not enable carrier readiness', () => {
  const result = getReadiness({
    I_CONNECT_SUPABASE_URL: 'https://example.supabase.co',
    I_CONNECT_SUPABASE_ANON_KEY: 'public-test-key',
    I_CONNECT_CARRIER_BRIDGE_URL: 'https://carrier.example'
  });
  assert.equal(result.productionReady, false);
  assert.equal(result.body.modules.database, 'configured');
  assert.equal(result.body.modules.carrier, 'missing_credentials');
  assert.equal(result.body.safeguards.pstnLive, false);
});

test('complete configuration reports readiness but does not claim external approval', () => {
  const result = getReadiness({
    I_CONNECT_SUPABASE_URL: 'https://example.supabase.co',
    I_CONNECT_SUPABASE_ANON_KEY: 'public-test-key',
    I_CONNECT_CARRIER_BRIDGE_URL: 'https://carrier.example',
    I_CONNECT_CARRIER_BRIDGE_SECRET: 'test-secret',
    I_CONNECT_PAYMENT_PROVIDER_SECRET: 'test-payment-secret'
  });
  assert.equal(result.productionReady, true);
  assert.equal(result.body.status, 'production_ready');
  assert.equal(result.body.safeguards.pstnLive, true);
  assert.equal(result.body.safeguards.realBilling, true);
  assert.deepEqual(result.body.missing, []);
});
