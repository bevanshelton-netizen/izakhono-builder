import assert from 'node:assert/strict';
import { PRODUCT } from './sales-confirmation.mjs';
import { createDeliveryJob, deliveryIsIdempotent } from './delivery-contract.mjs';

const paid = {
  status: 'paid',
  productId: PRODUCT.id,
  amount: 14900,
  currency: 'ZAR',
  provider: 'ikhokha',
  providerTransactionId: 'IK-2001',
  customerEmail: 'ARTIST@EXAMPLE.COM',
  confirmedAt: '2026-11-02T14:00:00Z',
};

const job = createDeliveryJob(paid);
assert.equal(job.jobType, 'digital-delivery');
assert.equal(job.jobId, 'business-of-music:IK-2001');
assert.equal(job.status, 'ready');
assert.equal(job.customerEmail, 'artist@example.com');
assert.equal(job.assetKey, 'business-of-music-sa-ebook');

assert.equal(deliveryIsIdempotent(new Set(), job), true);
assert.equal(deliveryIsIdempotent(new Set([job.jobId]), job), false);

assert.throws(
  () => createDeliveryJob({ ...paid, customerEmail: '' }),
  /customer email is required/
);

assert.throws(
  () => createDeliveryJob({ ...paid, status: 'pending' }),
  /purchase is not confirmed as paid/
);

console.log('Business of Music delivery contract acceptance: PASS');
