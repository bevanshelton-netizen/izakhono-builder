import type { FulfillmentJob, FulfillmentStore } from './payment-fulfillment.js';
import type { ReconciliationRecord, ReconciliationStore } from './payment-reconciliation.js';
import type { SettlementBatch, SettlementStore } from './payment-settlement.js';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface SupabasePaymentDurableStoreConfig {
  url: string;
  serviceRoleKey: string;
  fetcher?: Fetcher;
}

abstract class SupabaseRestStore {
  protected readonly fetcher: Fetcher;
  protected readonly restUrl: string;

  constructor(protected readonly config: SupabasePaymentDurableStoreConfig, table: string) {
    if (!config.url.trim()) throw new Error('Supabase URL is required');
    if (!config.serviceRoleKey.trim()) throw new Error('Supabase service-role key is required');
    this.restUrl = `${config.url.replace(/\/$/, '')}/rest/v1/${table}`;
    this.fetcher = config.fetcher ?? fetch;
  }

  protected headers(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    headers.set('apikey', this.config.serviceRoleKey);
    headers.set('Authorization', `Bearer ${this.config.serviceRoleKey}`);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    return headers;
  }

  protected async request(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    const response = await this.fetcher(input, { ...init, headers: this.headers(init.headers) });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Supabase durable store request failed: HTTP ${response.status}${detail ? ` ${detail}` : ''}`);
    }
    return response;
  }
}

export class SupabaseFulfillmentStore extends SupabaseRestStore implements FulfillmentStore {
  constructor(config: SupabasePaymentDurableStoreConfig) { super(config, 'iz_fulfillment_jobs'); }

  async create(job: FulfillmentJob): Promise<FulfillmentJob> {
    const response = await this.fetcher(this.restUrl, {
      method: 'POST', headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(toFulfillmentRow(job)),
    });
    if (response.status === 409) {
      const existing = await this.getByPaymentIntent(job.paymentIntentId);
      if (existing) return existing;
    }
    if (!response.ok) throw new Error(`Supabase fulfillment insert failed: HTTP ${response.status}`);
    const rows = await response.json() as FulfillmentRow[];
    if (!rows[0]) throw new Error('Supabase fulfillment insert returned no row');
    return fromFulfillmentRow(rows[0]);
  }

  async getByPaymentIntent(paymentIntentId: string): Promise<FulfillmentJob | undefined> {
    const url = `${this.restUrl}?payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=*&limit=1`;
    const response = await this.request(url, { method: 'GET' });
    const rows = await response.json() as FulfillmentRow[];
    return rows[0] ? fromFulfillmentRow(rows[0]) : undefined;
  }

  async update(id: string, patch: Partial<FulfillmentJob>): Promise<FulfillmentJob> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.paymentIntentId !== undefined) payload.payment_intent_id = patch.paymentIntentId;
    if (patch.merchantId !== undefined) payload.merchant_id = patch.merchantId;
    if (patch.serviceId !== undefined) payload.service_id = patch.serviceId;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.attempts !== undefined) payload.attempts = patch.attempts;
    if (patch.lastError !== undefined) payload.last_error = patch.lastError ?? null;
    if (patch.createdAt !== undefined) payload.created_at = patch.createdAt;
    const response = await this.request(`${this.restUrl}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
    });
    const rows = await response.json() as FulfillmentRow[];
    if (!rows[0]) throw new Error(`Unknown fulfillment job: ${id}`);
    return fromFulfillmentRow(rows[0]);
  }
}

export class SupabaseSettlementStore extends SupabaseRestStore implements SettlementStore {
  constructor(config: SupabasePaymentDurableStoreConfig) { super(config, 'iz_settlement_batches'); }

  async save(batch: SettlementBatch): Promise<void> {
    const response = await this.fetcher(this.restUrl, {
      method: 'POST', headers: this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(toSettlementRow(batch)),
    });
    if (!response.ok) throw new Error(`Supabase settlement insert failed: HTTP ${response.status}`);
  }

  async get(id: string): Promise<SettlementBatch | undefined> {
    const response = await this.request(`${this.restUrl}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { method: 'GET' });
    const rows = await response.json() as SettlementRow[];
    return rows[0] ? fromSettlementRow(rows[0]) : undefined;
  }

  async listPending(merchantId: string, currency: string): Promise<readonly SettlementBatch[]> {
    const url = `${this.restUrl}?merchant_id=eq.${encodeURIComponent(merchantId)}&currency=eq.${encodeURIComponent(currency)}&status=eq.pending&select=*`;
    const response = await this.request(url, { method: 'GET' });
    return (await response.json() as SettlementRow[]).map(fromSettlementRow);
  }

  async update(id: string, patch: Partial<SettlementBatch>): Promise<SettlementBatch> {
    const payload: Record<string, unknown> = {};
    if (patch.merchantId !== undefined) payload.merchant_id = patch.merchantId;
    if (patch.currency !== undefined) payload.currency = patch.currency;
    if (patch.amountMinor !== undefined) payload.amount_minor = patch.amountMinor;
    if (patch.transactionReferences !== undefined) payload.transaction_references = patch.transactionReferences;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.createdAt !== undefined) payload.created_at = patch.createdAt;
    if (patch.settledAt !== undefined) payload.settled_at = patch.settledAt ?? null;
    const response = await this.request(`${this.restUrl}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
    });
    const rows = await response.json() as SettlementRow[];
    if (!rows[0]) throw new Error(`Unknown settlement batch: ${id}`);
    return fromSettlementRow(rows[0]);
  }
}

export class SupabaseReconciliationStore extends SupabaseRestStore implements ReconciliationStore {
  constructor(config: SupabasePaymentDurableStoreConfig) { super(config, 'iz_reconciliation_records'); }

  async save(record: ReconciliationRecord): Promise<void> {
    const response = await this.fetcher(this.restUrl, {
      method: 'POST', headers: this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(toReconciliationRow(record)),
    });
    if (response.status === 409) return;
    if (!response.ok) throw new Error(`Supabase reconciliation insert failed: HTTP ${response.status}`);
  }

  async getByExternalTransactionId(externalTransactionId: string): Promise<ReconciliationRecord | undefined> {
    const url = `${this.restUrl}?external_transaction_id=eq.${encodeURIComponent(externalTransactionId)}&select=*&limit=1`;
    const response = await this.request(url, { method: 'GET' });
    const rows = await response.json() as ReconciliationRow[];
    return rows[0] ? fromReconciliationRow(rows[0]) : undefined;
  }
}

type FulfillmentRow = { id: string; payment_intent_id: string; merchant_id: string; service_id: string; status: FulfillmentJob['status']; attempts: number; last_error?: string | null; created_at: string; updated_at: string };
type SettlementRow = { id: string; merchant_id: string; currency: string; amount_minor: number; transaction_references: string[]; status: SettlementBatch['status']; created_at: string; settled_at?: string | null };
type ReconciliationRow = { id: string; provider: string; external_transaction_id: string; expected_amount_minor: number; observed_amount_minor: number; currency: string; matched: boolean; reason?: string | null; created_at: string };

function toFulfillmentRow(job: FulfillmentJob): FulfillmentRow {
  return { id: job.id, payment_intent_id: job.paymentIntentId, merchant_id: job.merchantId, service_id: job.serviceId, status: job.status, attempts: job.attempts, last_error: job.lastError ?? null, created_at: job.createdAt, updated_at: job.updatedAt };
}
function fromFulfillmentRow(row: FulfillmentRow): FulfillmentJob {
  return { id: row.id, paymentIntentId: row.payment_intent_id, merchantId: row.merchant_id, serviceId: row.service_id, status: row.status, attempts: row.attempts, lastError: row.last_error ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}
function toSettlementRow(batch: SettlementBatch): SettlementRow {
  return { id: batch.id, merchant_id: batch.merchantId, currency: batch.currency, amount_minor: batch.amountMinor, transaction_references: [...batch.transactionReferences], status: batch.status, created_at: batch.createdAt, settled_at: batch.settledAt ?? null };
}
function fromSettlementRow(row: SettlementRow): SettlementBatch {
  return { id: row.id, merchantId: row.merchant_id, currency: row.currency, amountMinor: row.amount_minor, transactionReferences: [...row.transaction_references], status: row.status, createdAt: row.created_at, settledAt: row.settled_at ?? undefined };
}
function toReconciliationRow(record: ReconciliationRecord): ReconciliationRow {
  return { id: record.id, provider: record.provider, external_transaction_id: record.externalTransactionId, expected_amount_minor: record.expectedAmountMinor, observed_amount_minor: record.observedAmountMinor, currency: record.currency, matched: record.matched, reason: record.reason ?? null, created_at: record.createdAt };
}
function fromReconciliationRow(row: ReconciliationRow): ReconciliationRecord {
  return { id: row.id, provider: row.provider, externalTransactionId: row.external_transaction_id, expectedAmountMinor: row.expected_amount_minor, observedAmountMinor: row.observed_amount_minor, currency: row.currency, matched: row.matched, reason: row.reason ?? undefined, createdAt: row.created_at };
}
