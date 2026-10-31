import assert from 'node:assert/strict';
import type { PaymentIntent } from './payment-core.js';
import type { RefundOperation, RefundOperationReservation, RefundOperationStore } from './payment-refund-operations-supabase.js';
import type { RefundProvider } from './payment-refunds.js';
import { RefundRecoveryWorker, type RefundRecoveryQueue } from './payment-refund-recovery-worker.js';

class Queue implements RefundRecoveryQueue {
  operation: RefundOperation;
  constructor(operation: RefundOperation) { this.operation = operation; }
  async reserve(input: Omit<RefundOperation, 'id' | 'status' | 'providerRefundId'>): Promise<RefundOperationReservation> { this.operation = { ...input, id: 'op', status: 'processing' }; return { kind: 'reserved', operation: this.operation }; }
  async markSucceeded(): Promise<RefundOperation> { throw new Error('not used'); }
  async markFailed(): Promise<RefundOperation> { throw new Error('not used'); }
  async markReconciliationRequired(): Promise<RefundOperation> { throw new Error('not used'); }
  async resolveSucceeded(refundId: string, providerRefundId: string): Promise<RefundOperation> { this.operation = { ...this.operation, status: 'succeeded', providerRefundId, reconciliationRequired: false }; return this.operation; }
  async resolveFailed(): Promise<RefundOperation> { this.operation = { ...this.operation, status: 'failed', reconciliationRequired: false }; return this.operation; }
  async listReconciliationRequired(): Promise<RefundOperation[]> { return this.operation.reconciliationRequired ? [this.operation] : []; }
  async recordRecoveryFailure(refundId: string, error: string, nextReconciliationAt: string): Promise<RefundOperation> { this.operation = { ...this.operation, lastError: error, nextReconciliationAt, recoveryAttemptCount: (this.operation.recoveryAttemptCount ?? 0) + 1 }; return this.operation; }
}

const now = new Date('2026-10-31T08:00:00.000Z');
const payment: PaymentIntent = { id: 'pay_worker_1', externalTransactionId: 'order_worker_1', amountMinor: 10000, currency: 'ZAR', status: 'paid', provider: 'test-provider', providerPaymentId: 'provider-payment-1', createdAt: now.toISOString(), updatedAt: now.toISOString() };
const queue = new Queue({ id: 'op', paymentIntentId: payment.id, refundId: `refund:${payment.id}:10000`, amountMinor: 10000, currency: 'ZAR', status: 'processing', reason: 'Customer refund', reconciliationRequired: true });
let refundRequests = 0;
let lookups = 0;
const provider: RefundProvider = {
  async requestRefund() { refundRequests += 1; return { providerRefundId: 'should-not-exist' }; },
  async reconcileRefund() { lookups += 1; return { outcome: 'succeeded', providerRefundId: 'provider-refund-worker-1' }; },
};
let finalized = 0;
const worker = new RefundRecoveryWorker(queue, async (id) => id === payment.id ? payment : undefined, new Map([['test-provider', provider]]), { async finalize() { finalized += 1; } }, () => now);
const result = await worker.run(10);
assert.deepEqual(result, { scanned: 1, succeeded: 1, failed: 0, deferred: 0, skipped: 0 });
assert.equal(lookups, 1);
assert.equal(refundRequests, 0);
assert.equal(finalized, 1);
assert.equal(queue.operation.status, 'succeeded');

console.log('payment-refund-recovery-worker.test.ts: ok');
