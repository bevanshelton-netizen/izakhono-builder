import type { PaymentIntent } from './payment-core.js';
import type { RefundOperation, RefundOperationStore } from './payment-refund-operations-supabase.js';
import type { RefundProvider } from './payment-refunds.js';

export type RefundRecoveryObservation =
  | { outcome: 'succeeded'; providerRefundId: string }
  | { outcome: 'failed' };

/** Resolves an ambiguous provider refund without issuing a second refund request. */
export class IzakhonoRefundRecovery {
  constructor(private readonly operations: RefundOperationStore, private readonly provider: RefundProvider) {}

  async reconcile(payment: PaymentIntent, amountMinor: number): Promise<RefundOperation> {
    if (payment.status !== 'paid') throw new Error('Refund reconciliation requires a paid payment');
    if (!payment.providerPaymentId) throw new Error('Paid payment has no provider payment ID');
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > payment.amountMinor) throw new Error('Refund amount must be a positive integer not exceeding the payment amount');
    if (!this.provider.reconcileRefund) throw new Error(`Provider ${payment.provider ?? 'unknown'} does not expose refund reconciliation`);

    const refundId = `refund:${payment.id}:${amountMinor}`;
    const reservation = await this.operations.reserve({ paymentIntentId: payment.id, refundId, amountMinor, currency: payment.currency, reason: 'Refund recovery' });
    if (reservation.kind === 'succeeded') return reservation.operation;
    if (reservation.kind === 'active') throw new Error('Refund is still processing; reconciliation is not yet permitted');
    if (reservation.kind !== 'reconciliation-required') throw new Error('Refund is not awaiting reconciliation');

    const observation = await this.provider.reconcileRefund({ providerPaymentId: payment.providerPaymentId, amountMinor, currency: payment.currency, refundId });
    if (observation.outcome === 'succeeded') {
      if (!observation.providerRefundId.trim()) throw new Error('Provider returned an empty refund ID during reconciliation');
      return this.operations.resolveSucceeded(refundId, observation.providerRefundId);
    }
    return this.operations.resolveFailed(refundId);
  }

  async resolve(refundId: string, observation: RefundRecoveryObservation): Promise<RefundOperation> {
    if (!refundId.trim()) throw new Error('Refund ID is required');
    if (observation.outcome === 'succeeded') {
      if (!observation.providerRefundId.trim()) throw new Error('Provider refund ID is required for a successful recovery');
      return this.operations.resolveSucceeded(refundId, observation.providerRefundId);
    }
    return this.operations.resolveFailed(refundId);
  }
}
