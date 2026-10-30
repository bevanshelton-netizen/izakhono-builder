export type SettlementStatus = 'pending' | 'settled' | 'failed';

export interface SettlementBatch {
  id: string;
  merchantId: string;
  currency: string;
  amountMinor: number;
  transactionReferences: readonly string[];
  status: SettlementStatus;
  createdAt: string;
  settledAt?: string;
}

export interface SettlementStore {
  save(batch: SettlementBatch): Promise<void>;
  get(id: string): Promise<SettlementBatch | undefined>;
  listPending(merchantId: string, currency: string): Promise<readonly SettlementBatch[]>;
  update(id: string, patch: Partial<SettlementBatch>): Promise<SettlementBatch>;
}

export class MemorySettlementStore implements SettlementStore {
  private readonly batches = new Map<string, SettlementBatch>();

  async save(batch: SettlementBatch): Promise<void> {
    if (this.batches.has(batch.id)) throw new Error('Duplicate settlement batch');
    this.batches.set(batch.id, { ...batch, transactionReferences: [...batch.transactionReferences] });
  }

  async get(id: string): Promise<SettlementBatch | undefined> {
    const batch = this.batches.get(id);
    return batch ? { ...batch, transactionReferences: [...batch.transactionReferences] } : undefined;
  }

  async listPending(merchantId: string, currency: string): Promise<readonly SettlementBatch[]> {
    return [...this.batches.values()]
      .filter((batch) => batch.merchantId === merchantId && batch.currency === currency && batch.status === 'pending')
      .map((batch) => ({ ...batch, transactionReferences: [...batch.transactionReferences] }));
  }

  async update(id: string, patch: Partial<SettlementBatch>): Promise<SettlementBatch> {
    const current = this.batches.get(id);
    if (!current) throw new Error(`Unknown settlement batch: ${id}`);
    const updated = { ...current, ...patch };
    this.batches.set(id, { ...updated, transactionReferences: [...updated.transactionReferences] });
    return { ...updated, transactionReferences: [...updated.transactionReferences] };
  }
}

/** Settlement coordinator. It never mutates the payment ledger; settlement is recorded as a new journal event. */
export class IzakhonoSettlement {
  constructor(private readonly store: SettlementStore) {}

  async create(input: {
    merchantId: string;
    currency: string;
    amountMinor: number;
    transactionReferences: readonly string[];
  }): Promise<SettlementBatch> {
    if (!input.merchantId.trim()) throw new Error('Merchant ID is required');
    if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error('Settlement currency must be an ISO 4217 code');
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Settlement amount must be a positive integer');
    if (input.transactionReferences.length === 0) throw new Error('Settlement requires at least one transaction reference');

    const batch: SettlementBatch = {
      id: `settle_${crypto.randomUUID()}`,
      merchantId: input.merchantId,
      currency: input.currency,
      amountMinor: input.amountMinor,
      transactionReferences: [...new Set(input.transactionReferences)],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await this.store.save(batch);
    return batch;
  }

  async markSettled(id: string): Promise<SettlementBatch> {
    const batch = await this.store.get(id);
    if (!batch) throw new Error(`Unknown settlement batch: ${id}`);
    if (batch.status === 'settled') return batch;
    if (batch.status === 'failed') throw new Error('Failed settlement cannot be marked settled without a new batch');
    return this.store.update(id, { status: 'settled', settledAt: new Date().toISOString() });
  }

  async markFailed(id: string): Promise<SettlementBatch> {
    const batch = await this.store.get(id);
    if (!batch) throw new Error(`Unknown settlement batch: ${id}`);
    if (batch.status === 'settled') throw new Error('Settled settlement cannot be marked failed');
    return this.store.update(id, { status: 'failed' });
  }
}
