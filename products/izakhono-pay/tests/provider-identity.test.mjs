import test from 'node:test';
import assert from 'node:assert/strict';
import { providerIdentityMatches } from '../src/provider-identity.js';

const intent = { id: 'pi_merchant_a_1', reference: 'IZP-A-1', app_slug: 'merchant-a', routed_provider: 'paystack' };

test('Paystack callback must match provider, reference, intent and merchant', () => {
  const valid = { reference: intent.reference, metadata: { intent_id: intent.id, app_slug: intent.app_slug } };
  assert.equal(providerIdentityMatches(intent, 'paystack', valid), true);
  assert.equal(providerIdentityMatches(intent, 'paystack', { ...valid, metadata: { ...valid.metadata, app_slug: 'merchant-b' } }), false);
  assert.equal(providerIdentityMatches(intent, 'paystack', { ...valid, metadata: { ...valid.metadata, intent_id: 'pi_other' } }), false);
  assert.equal(providerIdentityMatches({ ...intent, routed_provider: 'payfast' }, 'paystack', valid), false);
});

test('PayFast ITN must match provider, payment reference, merchant and intent', () => {
  const payfastIntent = { ...intent, routed_provider: 'payfast' };
  const valid = { m_payment_id: intent.reference, custom_str1: intent.app_slug, custom_str2: intent.id };
  assert.equal(providerIdentityMatches(payfastIntent, 'payfast', valid), true);
  assert.equal(providerIdentityMatches(payfastIntent, 'payfast', { ...valid, custom_str1: 'merchant-b' }), false);
  assert.equal(providerIdentityMatches(payfastIntent, 'payfast', { ...valid, custom_str2: 'pi_other' }), false);
});

test('iKhokha callback matches documented transaction reference and provider payment-link ID', () => {
  const ikhIntent = { ...intent, routed_provider: 'ikhokha', provider_reference: 'PAYLINK-A-1' };
  const valid = { paylinkID: 'PAYLINK-A-1', externalTransactionID: intent.reference, status: 'SUCCESS', responseCode: '00' };
  assert.equal(providerIdentityMatches(ikhIntent, 'ikhokha', valid), true);
  assert.equal(providerIdentityMatches(ikhIntent, 'ikhokha', { ...valid, paylinkID: 'PAYLINK-B-1' }), false);
  assert.equal(providerIdentityMatches(ikhIntent, 'ikhokha', { ...valid, externalTransactionID: 'IZP-B-1' }), false);
  assert.equal(providerIdentityMatches(ikhIntent, 'ikhokha', { ...valid, externalEntityID: 'merchant-b' }), true);
  assert.equal(providerIdentityMatches({ ...ikhIntent, provider_reference: null }, 'ikhokha', valid), false);
  assert.equal(providerIdentityMatches({ ...ikhIntent, routed_provider: 'payfast' }, 'ikhokha', valid), false);
});
