import type { RefundOperation } from './payment-refund-operations-supabase.js';
import type { PaymentIntent } from './payment-core.js';
import type { RefundProvider } from './payment-refunds.js';
import { RefundRecoveryWorker } from './payment-refund-recovery-worker.js';

const payment: PaymentIntent = {
  id: 'pay_concurrency_1', amountMinor: 1000, currency: 'ZAR', status: 'paid', provider: 'test', providerPaymentId: 'provider-payment-1', metadata: {}
};

const operation: RefundOperation = {
  id: 'op_concurrency_1', paymentIntentId: payment.id, refundId: `refund:${payment.id}:1000`, amountMinor: 1000,
  currency: 'ZAR', status: 'processing', reason: 'Recovery test', reconciliationRequired: true
};

class Queue {
  private claimed = false;
  private resolved: RefundOperation = operation;
  requestCalls = 0;
  reconcileCalls = 0;

  async listReconciliationRequired(): Promise<RefundOperation[]> { return [this.resolved]; }
  async claimRecovery(): Promise<boolean> { if (this.claimed) return false; this.claimed = true; return true; }
  async releaseRecovery(): Promise<void> { this.claimed = false; }
  async recordRecoveryFailure(): Promise<RefundOperation> { return this.resolved; }
  async reserve() { return { kind: 'reconciliation-required' as const, operation: this.resolved }; }
  async resolveSucceeded(_refundId: string, providerRefundId: string) { this.resolved = { ...this.resolved, status: 'succeeded', providerRefundId, reconciliationRequired: false }; return this.resolved; }
  async resolveFailed() { this.resolved = { ...this.resolved, status: 'failed', reconciliationRequired: false }; return this.resolved; }
}

const queue = new Queue();
const provider: RefundProvider = {
  async requestRefund() { queue.requestCalls += 1; throw new Error('requestRefund must never be called'); },
  async reconcileRefund() { queue.reconcileCalls += 1; return { outcome: 'succeeded' as const, providerRefundId: 'provider-refund-1' }; }
};

let finalized = 0;
const finalizer = { async finalize() { finalized += 1; } };
const worker1 = new RefundRecoveryWorker(queue, async () => payment, new Map([['test', provider]]), finalizer, () => new Date('2026-10-31T08:00:00.000Z'), 'worker-1');
const worker2 = new RefundRecoveryWorker(queue, async () => payment, new Map([['test', provider]]), finalizer, () => new Date('2026-10-31T08:00:00.000Z'), 'worker-2');

const [a, b] = await Promise.all([worker1.run(), worker2.run()]);
if (a.claimed + b.claimed !== 1) throw new Error('Expected exactly one worker to acquire the recovery claim');
if (queue.reconcileCalls !== 1) throw new Error('Expected exactly one provider reconciliation lookup');
if (queue.requestCalls !== 0) throw new Error('Recovery must never submit a new refund request');
if (finalized !== 1) throw new Error('Expected exactly one finalization');
console.log('payment-refund-recovery-concurrency.test.ts: ok');
