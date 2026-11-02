import assert from 'node:assert/strict';

export const PRODUCT = {
  id: 'business-of-music-ebook-sa',
  currency: 'ZAR',
  amount: 14900,
  provider: 'ikhokha',
};

/**
 * Normalize a provider-neutral payment confirmation into the evidence record
 * consumed by sales reporting and digital-delivery automation.
 *
 * IMPORTANT: a checkout click, redirect, or customer-submitted success page is
 * not confirmation. `status` must be `paid` and the provider transaction ID
 * must be present. Provider webhooks/API evidence should be the source of truth.
 */
export function normalizeConfirmedPurchase(input) {
  assert.equal(input?.status, 'paid', 'purchase is not confirmed as paid');
  assert.equal(input?.currency, PRODUCT.currency, 'unexpected currency');
  assert.equal(Number(input?.amount), PRODUCT.amount, 'unexpected purchase amount');
  assert.equal(input?.productId, PRODUCT.id, 'unexpected product');
  assert.ok(input?.providerTransactionId, 'provider transaction ID is required');
  assert.equal(input?.provider, PRODUCT.provider, 'unexpected payment provider');

  return {
    eventType: 'purchase.confirmed',
    productId: PRODUCT.id,
    amount: PRODUCT.amount,
    currency: PRODUCT.currency,
    provider: PRODUCT.provider,
    providerTransactionId: String(input.providerTransactionId),
    customerEmail: input.customerEmail ? String(input.customerEmail).trim().toLowerCase() : null,
    confirmedAt: input.confirmedAt ?? new Date().toISOString(),
    evidence: input.evidence ?? 'provider-confirmed-payment',
  };
}

export function isConfirmedPurchase(input) {
  try {
    normalizeConfirmedPurchase(input);
    return true;
  } catch {
    return false;
  }
}

export function deliveryId(purchase) {
  return `business-of-music:${purchase.providerTransactionId}`;
}

export function salesCount(purchases) {
  const unique = new Set();
  for (const purchase of purchases) {
    if (isConfirmedPurchase(purchase)) unique.add(String(purchase.providerTransactionId));
  }
  return unique.size;
}
