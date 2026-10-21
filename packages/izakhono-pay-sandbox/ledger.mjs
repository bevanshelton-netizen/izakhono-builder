export class Ledger {
  #entries = [];

  post({ transactionId, type, amountMinor, currency = 'ZAR', reference, metadata = {} }) {
    if (!transactionId || !type || !reference) throw new Error('transactionId, type and reference are required');
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('amountMinor must be a positive safe integer');
    const entry = Object.freeze({
      id: `le_${crypto.randomUUID()}`,
      transaction_id: transactionId,
      type,
      amount_minor: amountMinor,
      currency,
      reference,
      metadata,
      created_at: new Date().toISOString()
    });
    this.#entries.push(entry);
    return entry;
  }

  entries(transactionId) {
    return this.#entries.filter(e => e.transaction_id === transactionId);
  }

  balance(transactionId) {
    return this.entries(transactionId).reduce((sum, e) => {
      if (e.type === 'credit' || e.type === 'refund_debit') return sum + e.amount_minor;
      return sum - e.amount_minor;
    }, 0);
  }

  all() { return [...this.#entries]; }
}

export function reconcileTransaction({ transactionId, expectedStatus, providerStatus, expectedAmountMinor, providerAmountMinor }) {
  const checks = {
    transaction: Boolean(transactionId),
    status: expectedStatus === providerStatus,
    amount: expectedAmountMinor === providerAmountMinor
  };
  const matched = Object.values(checks).every(Boolean);
  return {
    transaction_id: transactionId,
    matched,
    action: matched ? 'release' : 'hold_for_review',
    checks
  };
}
