import type { PaymentIntent, PaymentStore } from './payment-core.js';
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

/**
 * Processes only already-quarantined refunds. It can never submit a new refund request.
 * Provider reconciliation is lookup-only; successful outcomes are handed to a finalizer.
 */
export class RefundRecoveryWorker {
  constructor(
    private readonly queue: RefundRecoveryQueue,
    private readonly payments: PaymentStore,
    private readonly providers: ReadonlyMap<string, RefundProvider>,
    private readonly finalizer: RefundRecoveryFinalizer,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async run(limit = 25): Promise<RefundRecoveryWorkerResult> {
    const now = this.clock().toISOString();
    const operations = await this.queue.listReconciliationRequired(limit, now);
    const result: RefundRecoveryWorkerResult = { scanned: operations.length, succeeded: 0, failed: 0, deferred: 0, skipped: 0 };

    for (const operation of operations) {
      const payment = await this.findPayment(operation);
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
        const recovery = new IzakhonoRefundRecovery(this.queue, provider);
        const resolved = await recovery.reconcile(payment, operation.amountMinor);
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

  private async findPayment(operation: RefundOperation): Promise<PaymentIntent | undefined> {
    // PaymentStore currently exposes lookup by external transaction ID, not by internal ID.
    // The queue may optionally attach the external transaction ID in a future durable projection.
    const candidate = await this.payments.getByExternalTransactionId(operation.paymentIntentId);
    return candidate?.id === operation.paymentIntentId ? candidate : undefined;
  }

  private async defer(operation: RefundOperation, error: string): Promise<void> {
    const attempts = Math.max(0, operation.recoveryAttemptCount ?? 0);
    const delayMinutes = Math.min(24 * 60, Math.max(1, 2 ** Math.min(attempts, 10)));
    const next = new Date(this.clock().getTime() + delayMinutes * 60_000).toISOString();
    await this.queue.recordRecoveryFailure(operation.refundId, error, next);
  }
}
