import assert from 'node:assert/strict';
import { PRODUCT, normalizeConfirmedPurchase, deliveryId } from './sales-confirmation.mjs';

export const DELIVERY = {
  productId: PRODUCT.id,
  assetType: 'ebook',
  assetKey: 'business-of-music-sa-ebook',
};

/**
 * Convert a provider-confirmed purchase into a deterministic delivery job.
 * This contract deliberately does not send email or expose the book itself.
 * A delivery adapter can consume the job once a real payment confirmation exists.
 */
export function createDeliveryJob(input) {
  const purchase = normalizeConfirmedPurchase(input);
  assert.ok(purchase.customerEmail, 'customer email is required for automatic delivery');

  return {
    jobType: 'digital-delivery',
    jobId: deliveryId(purchase),
    status: 'ready',
    productId: DELIVERY.productId,
    assetType: DELIVERY.assetType,
    assetKey: DELIVERY.assetKey,
    customerEmail: purchase.customerEmail,
    providerTransactionId: purchase.providerTransactionId,
    createdAt: purchase.confirmedAt,
  };
}

export function deliveryIsIdempotent(existingJobIds, job) {
  return !existingJobIds.has(job.jobId);
}
