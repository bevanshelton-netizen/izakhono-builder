import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseProvider,
  ikhokhaSignature,
  verifyIkhokhaSignature,
  buildIkhokhaStatusRequest,
  verifyIkhokhaStatus,
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
  const env = { PAYMENT_MODE: 'live', IKHOKHA_MODE: 'live', IKHOKHA_APP_ID: 'app', IKHOKHA_APP_SECRET: 'secret', PAYSTACK_SECRET_KEY: 'configured-test-key' };
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


test('iKhokha status lookup signs the external reference path and query', () => {
  const request = buildIkhokhaStatusRequest({
    env: { IKHOKHA_APP_ID: 'app-id', IKHOKHA_APP_SECRET: 'app-secret' },
    reference: 'IZP-ORDER-123'
  });
  const url = new URL(request.url);
  assert.equal(url.pathname, '/public-api/v1/api/getStatus/external');
  assert.equal(url.searchParams.get('externalReference'), 'IZP-ORDER-123');
  assert.equal(request.headers['IK-APPID'], 'app-id');
  assert.equal(request.headers['IK-SIGN'], ikhokhaSignature(url.pathname + url.search, '', 'app-secret'));
});

test('iKhokha status must match paid state, paylink ID and exact amount', () => {
  const intent = { provider_reference: 'PAYLINK-1', amount_minor: 14900 };
  assert.equal(verifyIkhokhaStatus({ status: 'PAID', paylinkID: 'PAYLINK-1', amount: 14900 }, intent), true);
  assert.equal(verifyIkhokhaStatus({ status: 'PENDING', paylinkID: 'PAYLINK-1', amount: 14900 }, intent), false);
  assert.equal(verifyIkhokhaStatus({ status: 'PAID', paylinkID: 'OTHER', amount: 14900 }, intent), false);
  assert.equal(verifyIkhokhaStatus({ status: 'PAID', paylinkID: 'PAYLINK-1', amount: 100 }, intent), false);
});
