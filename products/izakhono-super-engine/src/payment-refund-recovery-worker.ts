import type { PaymentIntent } from './payment-core.js';
import type { RefundOperation } from './payment-refund-operations-supabase.js';
import type { RefundProvider } from './payment-refunds.js';
import { IzakhonoRefundRecovery } from './payment-refund-recovery.js';

export interface RefundRecoveryQueue {
  listReconciliationRequired(limit?: number, now?: string): Promise<RefundOperation[]>;
  recordRecoveryFailure(refundId: string, error: string, nextReconciliationAt: string): Promise<RefundOperation>;
  claimRecovery?(refundId: string, claimId: string, claimedAt: string): Promise<boolean>;
  releaseRecovery?(refundId: string, claimId: string): Promise<void>;
}

export interface RefundRecoveryFinalizer {
  finalize(payment: PaymentIntent, operation: RefundOperation): Promise<void>;
}

export type RefundRecoveryWorkerResult = { scanned: number; succeeded: number; failed: number; deferred: number; skipped: number; claimed: number };

/** Processes only quarantined refunds. Durable claims prevent concurrent workers from reconciling the same refund. */
export class RefundRecoveryWorker {
  constructor(
    private readonly queue: RefundRecoveryQueue,
    private readonly loadPayment: (paymentIntentId: string) => Promise<PaymentIntent | undefined>,
    private readonly providers: ReadonlyMap<string, RefundProvider>,
    private readonly finalizer: RefundRecoveryFinalizer,
    private readonly clock: () => Date = () => new Date(),
    private readonly workerId: string = `recovery-worker:${crypto.randomUUID()}`,
  ) {}

  async run(limit = 25): Promise<RefundRecoveryWorkerResult> {
    const operations = await this.queue.listReconciliationRequired(limit, this.clock().toISOString());
    const result: RefundRecoveryWorkerResult = { scanned: operations.length, succeeded: 0, failed: 0, deferred: 0, skipped: 0, claimed: 0 };

    for (const operation of operations) {
      const claimId = `${this.workerId}:${operation.refundId}`;
      if (this.queue.claimRecovery && !(await this.queue.claimRecovery(operation.refundId, claimId, this.clock().toISOString()))) continue;
      result.claimed += this.queue.claimRecovery ? 1 : 0;
      try {
        const payment = await this.loadPayment(operation.paymentIntentId);
        if (!payment) { await this.defer(operation, `Payment intent ${operation.paymentIntentId} was not found`); result.deferred += 1; continue; }
        const provider = payment.provider ? this.providers.get(payment.provider) : undefined;
        if (!provider?.reconcileRefund) { result.skipped += 1; continue; }
        const resolved = await new IzakhonoRefundRecovery(this.queueAsRecoveryStore(), provider).reconcile(payment, operation.amountMinor);
        if (resolved.status === 'succeeded') { await this.finalizer.finalize(payment, resolved); result.succeeded += 1; }
        else result.failed += 1;
      } catch (error) {
        await this.defer(operation, error instanceof Error ? error.message : String(error));
        result.deferred += 1;
      } finally {
        if (this.queue.releaseRecovery) await this.queue.releaseRecovery(operation.refundId, claimId);
      }
    }
    return result;
  }

  private queueAsRecoveryStore() {
    return this.queue as Parameters<typeof IzakhonoRefundRecovery>[0];
  }

  private async defer(operation: RefundOperation, error: string): Promise<void> {
    const attempts = Math.max(0, operation.recoveryAttemptCount ?? 0);
    const delayMinutes = Math.min(24 * 60, Math.max(1, 2 ** Math.min(attempts, 10)));
    const next = new Date(this.clock().getTime() + delayMinutes * 60_000).toISOString();
    await this.queue.recordRecoveryFailure(operation.refundId, error, next);
  }
}
