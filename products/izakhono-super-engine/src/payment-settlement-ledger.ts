import type { LedgerTransaction, IzakhonoPaymentLedger } from './payment-ledger.js';
import type { SettlementBatch } from './payment-settlement.js';

export interface SettlementLedgerResult {
  transaction: LedgerTransaction;
  settlement: SettlementBatch;
}

/**
 * Records settlement as a new journal transaction. Existing payment entries are
 * never mutated; settlement is independently idempotent by settlement ID.
 */
export class PaymentSettlementLedger {
  constructor(private readonly ledger: IzakhonoPaymentLedger) {}

  async recordSettlement(input: {
    settlement: SettlementBatch;
    merchantPayableAccountId: string;
    settlementAccountId?: string;
  }): Promise<SettlementLedgerResult> {
    const { settlement } = input;
    if (!settlement.id.trim()) throw new Error('Settlement ID is required');
    if (!Number.isSafeInteger(settlement.amountMinor) || settlement.amountMinor <= 0) {
      throw new Error('Settlement amount must be a positive integer');
    }
    if (!/^[A-Z]{3}$/.test(settlement.currency)) throw new Error('Settlement currency must be an ISO 4217 code');
    if (!input.merchantPayableAccountId.trim()) throw new Error('Merchant payable account is required');

    const settlementAccountId = input.settlementAccountId?.trim() || `platform:settlement:${settlement.currency}`;
    const reference = `settlement:${settlement.id}`;

    // The public ledger API is intentionally used for journal creation so all
    // transactions continue through the same append-only store boundary.
    const transaction = await this.ledger.recordSettlement({
      reference,
      merchantId: settlement.merchantId,
      amountMinor: settlement.amountMinor,
      currency: settlement.currency,
      merchantPayableAccountId: input.merchantPayableAccountId,
      settlementAccountId,
    });

    return { transaction, settlement };
  }
}
