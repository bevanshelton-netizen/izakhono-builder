import type { LedgerTransaction, IzakhonoPaymentLedger } from './payment-ledger.js';
import type { PaymentIntent } from './payment-core.js';

export interface RefundLedgerResult {
  transaction: LedgerTransaction;
  refundId: string;
}

/** Records a refund as an independent append-only reversal journal entry. */
export class PaymentRefundLedger {
  constructor(private readonly ledger: IzakhonoPaymentLedger) {}

  async recordRefund(input: {
    refundId: string;
    payment: PaymentIntent;
    amountMinor?: number;
  }): Promise<RefundLedgerResult> {
    if (input.payment.status !== 'paid' && input.payment.status !== 'refunded') {
      throw new Error(`Refund ledger entry requires a paid or refunded payment; current status is ${input.payment.status}`);
    }
    const amountMinor = input.amountMinor ?? input.payment.amountMinor;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error('Refund amount must be a positive integer');
    }
    if (amountMinor > input.payment.amountMinor) {
      throw new Error('Refund amount cannot exceed the payment amount');
    }

    const transaction = await this.ledger.recordRefund({
      refundId: input.refundId,
      paymentIntentId: input.payment.id,
      merchantId: input.payment.externalTransactionId,
      amountMinor,
      currency: input.payment.currency,
    });

    return { transaction, refundId: input.refundId };
  }
}
