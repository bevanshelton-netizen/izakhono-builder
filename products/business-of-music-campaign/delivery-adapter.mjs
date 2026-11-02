import assert from 'node:assert/strict';
import { DELIVERY, createDeliveryJob } from './delivery-contract.mjs';

export const DELIVERY_ADAPTER = {
  provider: 'provider-neutral',
  mode: 'fail-closed',
};

/**
 * Prepare a delivery request without sending customer email.
 * A real email provider must be injected explicitly; no provider is assumed.
 */
export function prepareDeliveryRequest(input, adapter = null) {
  const job = input?.jobType === 'digital-delivery' ? input : createDeliveryJob(input);
  assert.equal(job.status, 'ready', 'delivery job is not ready');
  assert.equal(job.productId, DELIVERY.productId, 'unexpected delivery product');
  assert.equal(job.assetKey, DELIVERY.assetKey, 'unexpected delivery asset');
  assert.ok(job.customerEmail, 'customer email is required');

  if (!adapter || typeof adapter.send !== 'function') {
    return {
      status: 'blocked',
      reason: 'delivery-provider-not-configured',
      jobId: job.jobId,
      customerEmail: job.customerEmail,
      assetKey: job.assetKey,
    };
  }

  return {
    status: 'ready',
    jobId: job.jobId,
    provider: adapter.name ?? 'external-email-provider',
    send: () => adapter.send({
      to: job.customerEmail,
      productId: job.productId,
      assetKey: job.assetKey,
      jobId: job.jobId,
    }),
  };
}
