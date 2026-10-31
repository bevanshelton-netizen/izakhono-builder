import assert from 'node:assert/strict';
import type { PaymentIntent } from './payment-core.js';
import type { RefundOperation, RefundOperationReservation, RefundOperationStore } from './payment-refund-operations-supabase.js';
import { IzakhonoRefundRecovery } from './payment-refund-recovery.js';
import type { RefundProvider } from './payment-refunds.js';

const payment: PaymentIntent = {
  id: 'pay_recovery_1', externalTransactionId: 'order_recovery_1', amountMinor: 10000, currency: 'ZAR', status: 'paid',
  provider: 'test-provider', providerPaymentId: 'provider-payment-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

class MemoryRecoveryStore implements RefundOperationStore {
  private operation?: RefundOperation;
  async reserve(input: Omit<RefundOperation, 'id' | 'status' | 'providerRefundId'>): Promise<RefundOperationReservation> {
    if (!this.operation) {
      this.operation = { ...input, id: 'op_1', status: 'processing', reconciliationRequired: false };
      return { kind: 'reserved', operation: this.operation };
    }
    if (this.operation.status === 'succeeded') return { kind: 'succeeded', operation: this.operation };
    if (this.operation.reconciliationRequired) return { kind: 'reconciliation-required', operation: this.operation };
    return { kind: 'active', operation: this.operation };
  }
  async markSucceeded(): Promise<RefundOperation> { throw new Error('not used'); }
  async markFailed(): Promise<RefundOperation> { throw new Error('not used'); }
  async markReconciliationRequired(): Promise<RefundOperation> {
    if (!this.operation) throw new Error('missing operation');
    this.operation = { ...this.operation, reconciliationRequired: true };
    return this.operation;
  }
  async resolveSucceeded(refundId: string, providerRefundId: string): Promise<RefundOperation> {
    if (!this.operation || this.operation.refundId !== refundId) throw new Error('missing operation');
    this.operation = { ...this.operation, status: 'succeeded', providerRefundId, reconciliationRequired: false, resolvedAt: new Date().toISOString() };
    return this.operation;
  }
  async resolveFailed(refundId: string): Promise<RefundOperation> {
    if (!this.operation || this.operation.refundId !== refundId) throw new Error('missing operation');
    this.operation = { ...this.operation, status: 'failed', reconciliationRequired: false, resolvedAt: new Date().toISOString() };
    return this.operation;
  }
}

const store = new MemoryRecoveryStore();
let lookups = 0;
let refundRequests = 0;
const provider: RefundProvider = {
  async requestRefund() { refundRequests += 1; return { providerRefundId: 'unexpected' }; },
  async reconcileRefund() { lookups += 1; return { outcome: 'succeeded', providerRefundId: 'provider-refund-1' }; },
};

await store.reserve({ paymentIntentId: payment.id, refundId: `refund:${payment.id}:10000`, amountMinor: 10000, currency: 'ZAR', reason: 'Customer refund' });
await store.markReconciliationRequired(`refund:${payment.id}:10000`, 'transport timeout');
const recovery = new IzakhonoRefundRecovery(store, provider);
const resolved = await recovery.reconcile(payment, 10000);
assert.equal(resolved.status, 'succeeded');
assert.equal(resolved.providerRefundId, 'provider-refund-1');
assert.equal(lookups, 1);
assert.equal(refundRequests, 0);

console.log('payment-refund-recovery.test.ts: ok');
