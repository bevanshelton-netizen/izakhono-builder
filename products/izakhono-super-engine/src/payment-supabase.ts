import type { PaymentIntent, PaymentStore, PaymentStatus } from './payment-core.js';

/** Minimal fetch contract so the persistence layer remains runtime-neutral. */
export type SupabaseFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface SupabasePaymentStoreConfig {
  url: string;
  serviceRoleKey: string;
  fetcher?: SupabaseFetcher;
}

interface PaymentRow {
  id: string;
  external_transaction_id: string;
  amount_minor: number;
  currency: string;
  description?: string | null;
  status: PaymentStatus;
  provider?: string | null;
  provider_payment_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Durable payment store backed by Supabase PostgREST.
 *
 * The service-role credential must only exist server-side. This adapter deliberately
 * uses the PostgREST HTTP contract rather than a Supabase SDK so the engine remains
 * portable across runtimes and can later target any compatible Postgres gateway.
 */
export class SupabasePaymentStore implements PaymentStore {
  private readonly baseUrl: string;
  private readonly fetcher: SupabaseFetcher;

  constructor(private readonly config: SupabasePaymentStoreConfig) {
    if (!config.url.trim()) throw new Error('Supabase URL is required');
    if (!config.serviceRoleKey.trim()) throw new Error('Supabase service-role key is required');
    this.baseUrl = `${config.url.replace(/\/$/, '')}/rest/v1/iz_payment_intents`;
    this.fetcher = config.fetcher ?? fetch;
  }

  private headers(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    headers.set('apikey', this.config.serviceRoleKey);
    headers.set('Authorization', `Bearer ${this.config.serviceRoleKey}`);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    return headers;
  }

  private async request(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
    const response = await this.fetcher(input, { ...init, headers: this.headers(init.headers) });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Supabase payment store request failed: HTTP ${response.status}${detail ? ` ${detail}` : ''}`);
    }
    return response;
  }

  async save(intent: PaymentIntent): Promise<void> {
    await this.request(this.baseUrl, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: intent.id,
        external_transaction_id: intent.externalTransactionId,
        amount_minor: intent.amountMinor,
        currency: intent.currency,
        description: intent.description ?? null,
        status: intent.status,
        provider: intent.provider ?? null,
        provider_payment_id: intent.providerPaymentId ?? null,
        created_at: intent.createdAt,
        updated_at: intent.updatedAt,
      }),
    });
  }

  async getByExternalTransactionId(externalTransactionId: string): Promise<PaymentIntent | undefined> {
    const query = `${this.baseUrl}?external_transaction_id=eq.${encodeURIComponent(externalTransactionId)}&select=*`;
    const response = await this.request(query, { method: 'GET' });
    const rows = await response.json() as PaymentRow[];
    return rows[0] ? toPaymentIntent(rows[0]) : undefined;
  }

  async update(id: string, patch: Partial<PaymentIntent>): Promise<PaymentIntent> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.externalTransactionId !== undefined) payload.external_transaction_id = patch.externalTransactionId;
    if (patch.amountMinor !== undefined) payload.amount_minor = patch.amountMinor;
    if (patch.currency !== undefined) payload.currency = patch.currency;
    if (patch.description !== undefined) payload.description = patch.description ?? null;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.provider !== undefined) payload.provider = patch.provider ?? null;
    if (patch.providerPaymentId !== undefined) payload.provider_payment_id = patch.providerPaymentId ?? null;
    if (patch.createdAt !== undefined) payload.created_at = patch.createdAt;

    const query = `${this.baseUrl}?id=eq.${encodeURIComponent(id)}`;
    const response = await this.request(query, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    const rows = await response.json() as PaymentRow[];
    if (!rows[0]) throw new Error(`Unknown payment intent: ${id}`);
    return toPaymentIntent(rows[0]);
  }
}

function toPaymentIntent(row: PaymentRow): PaymentIntent {
  return {
    id: row.id,
    externalTransactionId: row.external_transaction_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    description: row.description ?? undefined,
    status: row.status,
    provider: row.provider ?? undefined,
    providerPaymentId: row.provider_payment_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
