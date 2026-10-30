export type LedgerAccountType = 'platform-clearing' | 'merchant-payable' | 'fees' | 'settlement';

export interface MerchantAccount {
  id: string;
  merchantId: string;
  currency: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface LedgerLine {
  accountId: string;
  direction: 'debit' | 'credit';
  amountMinor: number;
  currency: string;
}

export interface LedgerTransaction {
  id: string;
  reference: string;
  type: 'payment' | 'fee' | 'settlement' | 'refund';
  currency: string;
  lines: readonly LedgerLine[];
  createdAt: string;
}

export interface PaymentLedgerStore {
  createMerchantAccount(account: MerchantAccount): Promise<void>;
  getMerchantAccount(merchantId: string, currency: string): Promise<MerchantAccount | undefined>;
  hasTransaction(reference: string): Promise<boolean>;
  appendTransaction(transaction: LedgerTransaction): Promise<void>;
  listTransactions(): Promise<readonly LedgerTransaction[]>;
}

export class MemoryPaymentLedgerStore implements PaymentLedgerStore {
  private readonly accounts = new Map<string, MerchantAccount>();
  private readonly transactions = new Map<string, LedgerTransaction>();

  async createMerchantAccount(account: MerchantAccount): Promise<void> {
    const key = `${account.merchantId}:${account.currency}`;
    if (this.accounts.has(key)) throw new Error('Merchant account already exists');
    this.accounts.set(key, { ...account });
  }

  async getMerchantAccount(merchantId: string, currency: string): Promise<MerchantAccount | undefined> {
    const account = this.accounts.get(`${merchantId}:${currency}`);
    return account ? { ...account } : undefined;
  }

  async hasTransaction(reference: string): Promise<boolean> {
    return [...this.transactions.values()].some((item) => item.reference === reference);
  }

  async appendTransaction(transaction: LedgerTransaction): Promise<void> {
    if (this.transactions.has(transaction.id)) throw new Error('Duplicate ledger transaction');
    if (await this.hasTransaction(transaction.reference)) throw new Error('Duplicate ledger reference');
    this.transactions.set(transaction.id, { ...transaction, lines: transaction.lines.map((line) => ({ ...line })) });
  }

  async listTransactions(): Promise<readonly LedgerTransaction[]> {
    return [...this.transactions.values()].map((item) => ({ ...item, lines: item.lines.map((line) => ({ ...line })) }));
  }
}

/** Append-only double-entry ledger. No balance is mutable outside a journal transaction. */
export class IzakhonoPaymentLedger {
  constructor(private readonly store: PaymentLedgerStore) {}

  async ensureMerchantAccount(merchantId: string, currency: string): Promise<MerchantAccount> {
    const existing = await this.store.getMerchantAccount(merchantId, currency);
    if (existing) return existing;
    const account: MerchantAccount = {
      id: `merchant_${merchantId}_${currency}`,
      merchantId,
      currency,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    await this.store.createMerchantAccount(account);
    return account;
  }

  async recordPayment(input: { paymentIntentId: string; merchantId: string; amountMinor: number; currency: string }): Promise<LedgerTransaction> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Ledger amount must be a positive integer');
    if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('Ledger currency must be an ISO 4217 code');
    const account = await this.ensureMerchantAccount(input.merchantId, input.currency);
    if (account.status !== 'active') throw new Error('Merchant account is suspended');
    const reference = `payment:${input.paymentIntentId}`;
    if (await this.store.hasTransaction(reference)) {
      const existing = (await this.store.listTransactions()).find((item) => item.reference === reference);
      if (!existing) throw new Error('Ledger idempotency state is inconsistent');
      return existing;
    }
    const transaction: LedgerTransaction = {
      id: `ledger_${crypto.randomUUID()}`,
      reference,
      type: 'payment',
      currency: input.currency,
      lines: [
        { accountId: `platform:clearing:${input.currency}`, direction: 'debit', amountMinor: input.amountMinor, currency: input.currency },
        { accountId: account.id, direction: 'credit', amountMinor: input.amountMinor, currency: input.currency },
      ],
      createdAt: new Date().toISOString(),
    };
    validateBalanced(transaction);
    await this.store.appendTransaction(transaction);
    return transaction;
  }

  async recordSettlement(input: {
    reference: string;
    merchantId: string;
    amountMinor: number;
    currency: string;
    merchantPayableAccountId: string;
    settlementAccountId: string;
  }): Promise<LedgerTransaction> {
    if (!input.reference.trim()) throw new Error('Ledger reference is required');
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Settlement amount must be a positive integer');
    if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('Settlement currency must be an ISO 4217 code');
    if (!input.merchantPayableAccountId.trim() || !input.settlementAccountId.trim()) throw new Error('Settlement accounts are required');
    if (await this.store.hasTransaction(input.reference)) {
      const existing = (await this.store.listTransactions()).find((item) => item.reference === input.reference);
      if (!existing) throw new Error('Ledger settlement idempotency state is inconsistent');
      return existing;
    }
    const transaction: LedgerTransaction = {
      id: `ledger_${crypto.randomUUID()}`,
      reference: input.reference,
      type: 'settlement',
      currency: input.currency,
      lines: [
        { accountId: input.merchantPayableAccountId, direction: 'debit', amountMinor: input.amountMinor, currency: input.currency },
        { accountId: input.settlementAccountId, direction: 'credit', amountMinor: input.amountMinor, currency: input.currency },
      ],
      createdAt: new Date().toISOString(),
    };
    validateBalanced(transaction);
    await this.store.appendTransaction(transaction);
    return transaction;
  }

  async recordRefund(input: {
    refundId: string;
    paymentIntentId: string;
    merchantId: string;
    amountMinor: number;
    currency: string;
  }): Promise<LedgerTransaction> {
    if (!input.refundId.trim()) throw new Error('Refund ID is required');
    if (!input.paymentIntentId.trim()) throw new Error('Payment intent ID is required');
    if (!input.merchantId.trim()) throw new Error('Merchant ID is required');
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Refund amount must be a positive integer');
    if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('Refund currency must be an ISO 4217 code');
    const account = await this.ensureMerchantAccount(input.merchantId, input.currency);
    if (account.status !== 'active') throw new Error('Merchant account is suspended');
    const reference = `refund:${input.refundId}`;
    if (await this.store.hasTransaction(reference)) {
      const existing = (await this.store.listTransactions()).find((item) => item.reference === reference);
      if (!existing) throw new Error('Ledger refund idempotency state is inconsistent');
      return existing;
    }
    const transaction: LedgerTransaction = {
      id: `ledger_${crypto.randomUUID()}`,
      reference,
      type: 'refund',
      currency: input.currency,
      lines: [
        { accountId: account.id, direction: 'debit', amountMinor: input.amountMinor, currency: input.currency },
        { accountId: `platform:clearing:${input.currency}`, direction: 'credit', amountMinor: input.amountMinor, currency: input.currency },
      ],
      createdAt: new Date().toISOString(),
    };
    validateBalanced(transaction);
    await this.store.appendTransaction(transaction);
    return transaction;
  }
}

function validateBalanced(transaction: LedgerTransaction): void {
  if (transaction.lines.length < 2) throw new Error('Ledger transaction requires at least two lines');
  const debit = transaction.lines.filter((line) => line.direction === 'debit').reduce((sum, line) => sum + line.amountMinor, 0);
  const credit = transaction.lines.filter((line) => line.direction === 'credit').reduce((sum, line) => sum + line.amountMinor, 0);
  if (debit !== credit) throw new Error('Ledger transaction is not balanced');
  if (transaction.lines.some((line) => line.amountMinor <= 0 || !Number.isSafeInteger(line.amountMinor))) throw new Error('Ledger lines must use positive integer minor units');
  if (transaction.lines.some((line) => line.currency !== transaction.currency)) throw new Error('Ledger line currency mismatch');
}
