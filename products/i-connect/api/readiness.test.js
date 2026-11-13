const test = require('node:test');
const assert = require('node:assert/strict');
const { getReadiness } = require('./readiness');

test('missing integrations keep configuration incomplete and activation blocked', () => {
  const result = getReadiness({});
  assert.equal(result.productionReady, false);
  assert.equal(result.body.configurationComplete, false);
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

test('partial carrier credentials do not count as complete configuration', () => {
  const result = getReadiness({
    I_CONNECT_SUPABASE_URL: 'https://example.supabase.co',
    I_CONNECT_SUPABASE_ANON_KEY: 'public-test-key',
    I_CONNECT_CARRIER_BRIDGE_URL: 'https://carrier.example'
  });
  assert.equal(result.body.configurationComplete, false);
  assert.equal(result.body.modules.database, 'configured_unverified');
  assert.equal(result.body.modules.carrier, 'missing_credentials');
  assert.equal(result.body.safeguards.pstnLive, false);
});

test('complete configuration never independently enables production, PSTN or billing', () => {
  const result = getReadiness({
    I_CONNECT_SUPABASE_URL: 'https://example.supabase.co',
    I_CONNECT_SUPABASE_ANON_KEY: 'public-test-key',
    I_CONNECT_CARRIER_BRIDGE_URL: 'https://carrier.example',
    I_CONNECT_CARRIER_BRIDGE_SECRET: 'test-secret',
    I_CONNECT_PAYMENT_PROVIDER_SECRET: 'test-payment-secret'
  });
  assert.equal(result.body.configurationComplete, true);
  assert.equal(result.productionReady, false);
  assert.equal(result.body.productionReady, false);
  assert.equal(result.body.status, 'configuration_complete_activation_required');
  assert.equal(result.body.modules.carrier, 'configured_unverified');
  assert.equal(result.body.modules.payments, 'configured_unverified');
  assert.equal(result.body.safeguards.pstnLive, false);
  assert.equal(result.body.safeguards.realBilling, false);
  assert.equal(result.body.safeguards.activationRequiresIndependentApproval, true);
  assert.deepEqual(result.body.missing, []);
});
