import assert from 'node:assert/strict';
import { IzakhonoPaymentLedger, MemoryPaymentLedgerStore } from './payment-ledger.js';

describe('IZAKHONO PAY ledger', () => {
  it('creates merchant accounts and records a balanced payment once', async () => {
    const ledger = new IzakhonoPaymentLedger(new MemoryPaymentLedgerStore());
    const first = await ledger.recordPayment({ paymentIntentId: 'pay_1', merchantId: 'merchant_1', amountMinor: 14900, currency: 'ZAR' });
    const second = await ledger.recordPayment({ paymentIntentId: 'pay_1', merchantId: 'merchant_1', amountMinor: 14900, currency: 'ZAR' });
    assert.equal(first.id, second.id);
    assert.equal(first.lines[0].amountMinor, 14900);
    assert.equal(first.lines[1].amountMinor, 14900);
    assert.equal(first.lines[0].direction, 'debit');
    assert.equal(first.lines[1].direction, 'credit');
  });
});
