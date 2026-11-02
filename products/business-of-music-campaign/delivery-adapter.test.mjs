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
