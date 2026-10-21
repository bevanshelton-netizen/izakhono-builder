import assert from 'node:assert/strict';
import { Ledger, reconcileTransaction } from './ledger.mjs';

const ledger = new Ledger();
ledger.post({ transactionId: 'tx_001', type: 'credit', amountMinor: 10000, reference: 'payment' });
ledger.post({ transactionId: 'tx_001', type: 'debit', amountMinor: 2500, reference: 'fee' });
ledger.post({ transactionId: 'tx_001', type: 'refund_debit', amountMinor: 1000, reference: 'refund' });

assert.equal(ledger.entries('tx_001').length, 3);
assert.equal(ledger.balance('tx_001'), 8500);

const match = reconcileTransaction({
  transactionId: 'tx_001', expectedStatus: 'succeeded', providerStatus: 'succeeded',
  expectedAmountMinor: 10000, providerAmountMinor: 10000
});
assert.equal(match.matched, true);
assert.equal(match.action, 'release');

const mismatch = reconcileTransaction({
  transactionId: 'tx_001', expectedStatus: 'succeeded', providerStatus: 'declined',
  expectedAmountMinor: 10000, providerAmountMinor: 9000
});
assert.equal(mismatch.matched, false);
assert.equal(mismatch.action, 'hold_for_review');

console.log('IZAKHONO PAY ledger/reconciliation QC: GREEN');
