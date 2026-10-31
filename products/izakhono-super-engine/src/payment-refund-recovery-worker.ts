import type { PaymentIntent } from './payment-core.js';
import type { RefundOperation, RefundOperationStore } from './payment-refund-operations-supabase.js';
import type { RefundProvider } from './payment-refunds.js';
import { IzakhonoRefundRecovery } from './payment-refund-recovery.js';

export interface RefundRecoveryQueue extends RefundOperationStore {
  listReconciliationRequired(limit?: number, now?: string): Promise<RefundOperation[]>;
  recordRecoveryFailure(refundId: string, error: string, nextReconciliationAt: string): Promise<RefundOperation>;
}

export interface RefundRecoveryFinalizer {
  finalize(payment: PaymentIntent, operation: RefundOperation): Promise<void>;
}

export type RefundRecoveryWorkerResult = {
  scanned: number;
  succeeded: number;
  failed: number;
  deferred: number;
  skipped: number;
};

/** Processes only quarantined refunds; it can never submit a new refund request. */
export class RefundRecoveryWorker {
  constructor(
    private readonly queue: RefundRecoveryQueue,
    private readonly loadPayment: (paymentIntentId: string) => Promise<PaymentIntent | undefined>,
    private readonly providers: ReadonlyMap<string, RefundProvider>,
    private readonly finalizer: RefundRecoveryFinalizer,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async run(limit = 25): Promise<RefundRecoveryWorkerResult> {
    const operations = await this.queue.listReconciliationRequired(limit, this.clock().toISOString());
    const result: RefundRecoveryWorkerResult = { scanned: operations.length, succeeded: 0, failed: 0, deferred: 0, skipped: 0 };

    for (const operation of operations) {
      const payment = await this.loadPayment(operation.paymentIntentId);
      if (!payment) {
        await this.defer(operation, `Payment intent ${operation.paymentIntentId} was not found`);
        result.deferred += 1;
        continue;
      }
      const provider = payment.provider ? this.providers.get(payment.provider) : undefined;
      if (!provider?.reconcileRefund) {
        result.skipped += 1;
        continue;
      }

      try {
        const resolved = await new IzakhonoRefundRecovery(this.queue, provider).reconcile(payment, operation.amountMinor);
        if (resolved.status === 'succeeded') {
          await this.finalizer.finalize(payment, resolved);
          result.succeeded += 1;
        } else {
          result.failed += 1;
        }
      } catch (error) {
        await this.defer(operation, error instanceof Error ? error.message : String(error));
        result.deferred += 1;
      }
    }
    return result;
  }

  private async defer(operation: RefundOperation, error: string): Promise<void> {
    const attempts = Math.max(0, operation.recoveryAttemptCount ?? 0);
    const delayMinutes = Math.min(24 * 60, Math.max(1, 2 ** Math.min(attempts, 10)));
    const next = new Date(this.clock().getTime() + delayMinutes * 60_000).toISOString();
    await this.queue.recordRecoveryFailure(operation.refundId, error, next);
  }
}
