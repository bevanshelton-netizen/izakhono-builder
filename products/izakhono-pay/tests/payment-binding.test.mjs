import test from 'node:test';
import assert from 'node:assert/strict';
import { providerIdentityMatches } from '../src/payment-binding.js';

const intent = { id: 'pi_123', reference: 'IZP-123', app_slug: 'merchant-a', routed_provider: 'paystack' };

test('Paystack identity must match provider, intent and merchant', () => {
  assert.equal(providerIdentityMatches(intent, 'paystack', { metadata: { intent_id: 'pi_123', app_slug: 'merchant-a' } }), true);
  assert.equal(providerIdentityMatches(intent, 'paystack', { metadata: { intent_id: 'pi_123', app_slug: 'merchant-b' } }), false);
  assert.equal(providerIdentityMatches(intent, 'paystack', { metadata: { intent_id: 'pi_other', app_slug: 'merchant-a' } }), false);
  assert.equal(providerIdentityMatches(intent, 'payfast', { m_payment_id: 'IZP-123', custom_str1: 'merchant-a', custom_str2: 'pi_123' }), false);
});

test('iKhokha identity binds external entity and transaction reference', () => {
  const ikhokhaIntent = { ...intent, routed_provider: 'ikhokha' };
  assert.equal(providerIdentityMatches(ikhokhaIntent, 'ikhokha', { externalEntityID: 'merchant-a', externalTransactionID: 'IZP-123' }), true);
  assert.equal(providerIdentityMatches(ikhokhaIntent, 'ikhokha', { externalEntityID: 'merchant-b', externalTransactionID: 'IZP-123' }), false);
});

test('PayFast identity binds merchant, intent and payment reference', () => {
  const payfastIntent = { ...intent, routed_provider: 'payfast' };
  assert.equal(providerIdentityMatches(payfastIntent, 'payfast', { m_payment_id: 'IZP-123', custom_str1: 'merchant-a', custom_str2: 'pi_123' }), true);
  assert.equal(providerIdentityMatches(payfastIntent, 'payfast', { m_payment_id: 'IZP-123', custom_str1: 'merchant-b', custom_str2: 'pi_123' }), false);
  assert.equal(providerIdentityMatches(payfastIntent, 'payfast', { m_payment_id: 'IZP-123', custom_str1: 'merchant-a', custom_str2: 'pi_other' }), false);
});

test('malformed or absent provider identity fails closed', () => {
  assert.equal(providerIdentityMatches(intent, 'paystack', { metadata: '{bad json' }), false);
  assert.equal(providerIdentityMatches(intent, 'paystack', {}), false);
  assert.equal(providerIdentityMatches(null, 'paystack', {}), false);
});
