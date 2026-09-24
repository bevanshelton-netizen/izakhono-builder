import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseProvider,
  ikhokhaSignature,
  verifyIkhokhaSignature,
  ipv4InCidr,
  md5Hex,
  payfastEncode,
  payfastParamString,
  paystackSignature,
  verifyPaystackSignature
} from '../src/core.js';

test('mock mode always routes to mock', () => {
  assert.equal(chooseProvider({ PAYMENT_MODE: 'mock' }, 'ZAR', 'smart'), 'mock');
});

test('smart ZAR routing prefers configured iKhokha in verified live mode', () => {
  const env = { PAYMENT_MODE: 'live', IKHOKHA_MODE: 'live', IKHOKHA_APP_ID: 'app', IKHOKHA_APP_SECRET: 'secret', PAYSTACK_SECRET_KEY: 'sk_live_x' };
  assert.equal(chooseProvider(env, 'ZAR', 'smart'), 'ikhokha');
});

test('iKhokha stays disabled outside live mode', () => {
  const env = { PAYMENT_MODE: 'sandbox', IKHOKHA_MODE: 'live', IKHOKHA_APP_ID: 'app', IKHOKHA_APP_SECRET: 'secret', PAYSTACK_SECRET_KEY: 'sk_test_x' };
  assert.equal(chooseProvider(env, 'ZAR', 'smart'), 'paystack');
});

test('iKhokha HMAC verification accepts only the correct signature', () => {
  const raw = JSON.stringify({ externalTransactionID: 'IZP-123', status: 'SUCCESS', responseCode: '00' });
  const secret = 'test-secret';
  const sig = ikhokhaSignature('/api/webhooks/ikhokha', raw, secret);
  assert.equal(verifyIkhokhaSignature('/api/webhooks/ikhokha', raw, sig, secret), true);
  assert.equal(verifyIkhokhaSignature('/api/webhooks/ikhokha', raw, sig.slice(0, -1) + '0', secret), false);
});

test('smart ZAR routing prefers configured Paystack, then PayFast when iKhokha is unavailable', () => {
  const paystack = { PAYMENT_MODE: 'sandbox', PAYSTACK_SECRET_KEY: 'sk_test_x', PAYFAST_MERCHANT_ID: '1', PAYFAST_MERCHANT_KEY: 'k' };
  assert.equal(chooseProvider(paystack, 'ZAR', 'smart'), 'paystack');
  const payfast = { PAYMENT_MODE: 'sandbox', PAYSTACK_ENABLED: 'false', PAYFAST_MERCHANT_ID: '1', PAYFAST_MERCHANT_KEY: 'k' };
  assert.equal(chooseProvider(payfast, 'ZAR', 'smart'), 'payfast');
});

test('non-ZAR currency fails closed in alpha', () => {
  assert.equal(chooseProvider({ PAYMENT_MODE: 'live', PAYSTACK_SECRET_KEY: 'configured-test-key' }, 'USD', 'smart'), null);
});

test('PayFast encoding uses plus for spaces and uppercase percent escapes', () => {
  assert.equal(payfastEncode('A B/C'), 'A+B%2FC');
  assert.equal(payfastParamString([['item_name', 'A B'], ['amount', '5.00']]), 'item_name=A+B&amount=5.00');
});

test('MD5 helper matches a known vector', () => {
  assert.equal(md5Hex('hello'), '5d41402abc4b2a76b9719d911017c592');
});

test('Paystack HMAC verification accepts only the correct signature', () => {
  const raw = '{"event":"charge.success"}';
  const secret = 'sk_test_secret';
  const sig = paystackSignature(raw, secret);
  assert.equal(verifyPaystackSignature(raw, sig, secret), true);
  assert.equal(verifyPaystackSignature(raw, sig.slice(0, -1) + '0', secret), false);
});

test('IPv4 CIDR matching handles PayFast-style ranges', () => {
  assert.equal(ipv4InCidr('197.97.145.150', '197.97.145.144/28'), true);
  assert.equal(ipv4InCidr('197.97.145.160', '197.97.145.144/28'), false);
  assert.equal(ipv4InCidr('144.126.193.139', '144.126.193.139/32'), true);
});
