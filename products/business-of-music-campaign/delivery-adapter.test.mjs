import assert from 'node:assert/strict';
import { prepareDeliveryRequest } from './delivery-adapter.mjs';

const purchase = {
  status: 'paid',
  currency: 'ZAR',
  amount: 14900,
  productId: 'business-of-music-ebook-sa',
  provider: 'ikhokha',
  providerTransactionId: 'IK-3001',
  customerEmail: 'Artist@Example.com',
  confirmedAt: '2026-11-02T18:00:00.000Z',
};

const blocked = prepareDeliveryRequest(purchase);
assert.equal(blocked.status, 'blocked');
assert.equal(blocked.reason, 'delivery-provider-not-configured');
assert.equal(blocked.jobId, 'business-of-music:IK-3001');

let sent = null;
const ready = prepareDeliveryRequest(purchase, {
  name: 'test-provider',
  send(payload) {
    sent = payload;
    return { accepted: true, providerMessageId: 'MSG-1' };
  },
});

assert.equal(ready.status, 'ready');
assert.equal(ready.provider, 'test-provider');
const result = ready.send();
assert.deepEqual(result, { accepted: true, providerMessageId: 'MSG-1' });
assert.deepEqual(sent, {
  to: 'artist@example.com',
  productId: 'business-of-music-ebook-sa',
  assetKey: 'business-of-music-sa-ebook',
  jobId: 'business-of-music:IK-3001',
});

assert.throws(() => prepareDeliveryRequest({
  ...purchase,
  status: 'pending',
}));


import { createHmac } from 'node:crypto';
import { buildCreatePaymentLink, verifyIkhokhaWebhook, isValidPaymentNotification } from './ikhokha-api.mjs';

const signedRequest = buildCreatePaymentLink({
  appId: 'APP-TEST',
  appSecret: 'test-secret',
  callbackUrl: 'https://example.test/api/ikhokha/callback',
  successUrl: 'https://example.test/paid',
  failureUrl: 'https://example.test/failed',
  requesterUrl: 'https://example.test/checkout',
  externalTransactionId: 'BOM-ORDER-001',
  customerReference: 'BOM-CUSTOMER-001',
});
assert.equal(signedRequest.url, 'https://api.ikhokha.com/public-api/v1/api/payment');
assert.equal(signedRequest.headers['IK-APPID'], 'APP-TEST');
assert.equal(JSON.parse(signedRequest.bodyText).amount, 14900);
assert.equal(JSON.parse(signedRequest.bodyText).externalTransactionID, 'BOM-ORDER-001');
assert.ok(/^[a-f0-9]{64}$/.test(signedRequest.headers['IK-SIGN']));
assert.throws(() => buildCreatePaymentLink({
  appId: 'APP-TEST', appSecret: 'test-secret',
  callbackUrl: 'https://example.test/callback', successUrl: 'https://example.test/paid',
  failureUrl: 'https://example.test/failed', requesterUrl: 'https://example.test',
  externalTransactionId: 'BOM-ORDER-002', customerReference: 'BOM-CUSTOMER-001', amount: 100,
}), /Unexpected product amount/);

const callbackPath = '/api/ikhokha/callback';
const callbackBody = JSON.stringify({
  paylinkID: 'PAYLINK-001',
  status: 'SUCCESS',
  externalTransactionID: 'BOM-ORDER-001',
  responseCode: '00',
});
const escapedPayload = (callbackPath + callbackBody).replace(/[\\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
const callbackSignature = createHmac('sha256', 'test-secret').update(escapedPayload, 'utf8').digest('hex');
assert.equal(verifyIkhokhaWebhook({
  appId: 'APP-TEST', expectedAppId: 'APP-TEST', appSecret: 'test-secret',
  callbackPath, rawBody: callbackBody, signature: callbackSignature,
}), true);
assert.equal(verifyIkhokhaWebhook({
  appId: 'APP-OTHER', expectedAppId: 'APP-TEST', appSecret: 'test-secret',
  callbackPath, rawBody: callbackBody, signature: callbackSignature,
}), false);
assert.equal(isValidPaymentNotification(JSON.parse(callbackBody)), true);
assert.equal(isValidPaymentNotification({ ...JSON.parse(callbackBody), status: 'FAILURE' }), false);
