import assert from 'node:assert/strict';
import {
  PRODUCT,
  normalizeConfirmedPurchase,
  isConfirmedPurchase,
  deliveryId,
  salesCount,
} from './sales-confirmation.mjs';

const paid = {
  status: 'paid',
  productId: PRODUCT.id,
  amount: 14900,
  currency: 'ZAR',
  provider: 'ikhokha',
  providerTransactionId: 'IK-1001',
  customerEmail: 'ARTIST@EXAMPLE.COM',
  confirmedAt: '2026-11-02T11:00:00Z',
};

const normalized = normalizeConfirmedPurchase(paid);
assert.equal(normalized.eventType, 'purchase.confirmed');
assert.equal(normalized.customerEmail, 'artist@example.com');
assert.equal(deliveryId(normalized), 'business-of-music:IK-1001');
assert.equal(isConfirmedPurchase(paid), true);

// A checkout attempt or client-side success redirect must never count.
assert.equal(isConfirmedPurchase({ ...paid, status: 'pending' }), false);
assert.equal(isConfirmedPurchase({ ...paid, providerTransactionId: '' }), false);
assert.equal(isConfirmedPurchase({ ...paid, amount: 9900 }), false);
assert.equal(isConfirmedPurchase({ ...paid, provider: 'unknown' }), false);

// Duplicate webhook delivery for the same provider transaction counts once.
assert.equal(salesCount([paid, { ...paid, confirmedAt: '2026-11-02T11:01:00Z' }]), 1);
assert.equal(salesCount([paid, { ...paid, providerTransactionId: 'IK-1002' }]), 2);

console.log('Business of Music sales confirmation acceptance: PASS');
