import type { RefundOperation, RefundOperationStore } from './payment-refund-operations-supabase.js';

export type RefundRecoveryObservation =
  | { outcome: 'succeeded'; providerRefundId: string }
  | { outcome: 'failed' };

/** Resolves an ambiguous provider refund without issuing a second refund request. */
export class IzakhonoRefundRecovery {
  constructor(private readonly operations: RefundOperationStore) {}

  async resolve(refundId: string, observation: RefundRecoveryObservation): Promise<RefundOperation> {
    if (!refundId.trim()) throw new Error('Refund ID is required');
    if (observation.outcome === 'succeeded') {
      if (!observation.providerRefundId.trim()) throw new Error('Provider refund ID is required for a successful recovery');
      return this.operations.resolveSucceeded(refundId, observation.providerRefundId);
    }
    return this.operations.resolveFailed(refundId);
  }
}
