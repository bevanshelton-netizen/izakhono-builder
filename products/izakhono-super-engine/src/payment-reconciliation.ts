export interface ReconciliationRecord {
  id: string;
  provider: string;
  externalTransactionId: string;
  expectedAmountMinor: number;
  observedAmountMinor: number;
  currency: string;
  matched: boolean;
  reason?: string;
  createdAt: string;
}

export interface ReconciliationStore {
  save(record: ReconciliationRecord): Promise<void>;
  getByExternalTransactionId(externalTransactionId: string): Promise<ReconciliationRecord | undefined>;
}

export class MemoryReconciliationStore implements ReconciliationStore {
  private readonly records = new Map<string, ReconciliationRecord>();

  async save(record: ReconciliationRecord): Promise<void> {
    if (this.records.has(record.externalTransactionId)) throw new Error('Duplicate reconciliation record');
    this.records.set(record.externalTransactionId, { ...record });
  }

  async getByExternalTransactionId(externalTransactionId: string): Promise<ReconciliationRecord | undefined> {
    const record = this.records.get(externalTransactionId);
    return record ? { ...record } : undefined;
  }
}

/** Compares provider settlement observations against the immutable payment intent. */
export class IzakhonoReconciliation {
  constructor(private readonly store: ReconciliationStore) {}

  async reconcile(input: {
    provider: string;
    externalTransactionId: string;
    expectedAmountMinor: number;
    observedAmountMinor: number;
    currency: string;
  }): Promise<ReconciliationRecord> {
    const existing = await this.store.getByExternalTransactionId(input.externalTransactionId);
    if (existing) return existing;

    const amountMatches = input.expectedAmountMinor === input.observedAmountMinor;
    const currencyValid = /^[A-Z]{3}$/.test(input.currency);
    const record: ReconciliationRecord = {
      id: `recon_${crypto.randomUUID()}`,
      provider: input.provider,
      externalTransactionId: input.externalTransactionId,
      expectedAmountMinor: input.expectedAmountMinor,
      observedAmountMinor: input.observedAmountMinor,
      currency: input.currency,
      matched: amountMatches && currencyValid,
      reason: amountMatches && currencyValid ? undefined : amountMatches ? 'Invalid currency' : 'Amount mismatch',
      createdAt: new Date().toISOString(),
    };
    await this.store.save(record);
    return record;
  }
}
