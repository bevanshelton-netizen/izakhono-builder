import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { IzakhonoPaymentLedger, MemoryPaymentLedgerStore } from './payment-ledger.js';
import { PaymentRefundLedger } from './payment-refund-ledger.js';

describe('PaymentRefundLedger', () => {
  it('records a balanced reversal and is idempotent by refund ID', async () => {
    const store = new MemoryPaymentLedgerStore();
    const ledger = new IzakhonoPaymentLedger(store);
    const refunds = new PaymentRefundLedger(ledger);
    const payment = {
      id: 'pay_123',
      externalTransactionId: 'ext_123',
      amountMinor: 14900,
      currency: 'ZAR',
      description: 'Test payment',
      status: 'paid' as const,
      provider: 'ikhokha',
      providerPaymentId: 'pl_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await ledger.recordPayment({
      paymentIntentId: payment.id,
      merchantId: 'merchant_1',
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    });

    const first = await refunds.recordRefund({
      refundId: 'rf_123',
      payment,
      merchantId: 'merchant_1',
    });
    const second = await refunds.recordRefund({
      refundId: 'rf_123',
      payment: { ...payment, status: 'refunded' },
      merchantId: 'merchant_1',
    });

    assert.equal(first.transaction.id, second.transaction.id);
    assert.equal(first.transaction.type, 'refund');
    assert.deepEqual(first.transaction.lines, [
      { accountId: 'merchant_merchant_1_ZAR', direction: 'debit', amountMinor: 14900, currency: 'ZAR' },
      { accountId: 'platform:clearing:ZAR', direction: 'credit', amountMinor: 14900, currency: 'ZAR' },
    ]);
    assert.equal((await store.listTransactions()).length, 2);
  });

  it('rejects refunds larger than the original payment', async () => {
    const refunds = new PaymentRefundLedger(new IzakhonoPaymentLedger(new MemoryPaymentLedgerStore()));
    const payment = {
      id: 'pay_456',
      externalTransactionId: 'ext_456',
      amountMinor: 5000,
      currency: 'ZAR',
      description: 'Test payment',
      status: 'paid' as const,
      provider: 'ikhokha',
      providerPaymentId: 'pl_456',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await assert.rejects(
      () => refunds.recordRefund({ refundId: 'rf_456', payment, merchantId: 'merchant_1', amountMinor: 5001 }),
      /cannot exceed/,
    );
  });
});
