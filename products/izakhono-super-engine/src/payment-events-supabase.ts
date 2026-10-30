import type { PaymentEvent, PaymentEventStore } from './payment-events.js';

export type SupabasePaymentEventStoreConfig = {
  url: string;
  serviceRoleKey: string;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export class SupabasePaymentEventStore implements PaymentEventStore {
  private readonly baseUrl: string;
  private readonly fetcher: NonNullable<SupabasePaymentEventStoreConfig['fetcher']>;

  constructor(private readonly config: SupabasePaymentEventStoreConfig) {
    if (!config.url.trim()) throw new Error('Supabase URL is required');
    if (!config.serviceRoleKey.trim()) throw new Error('Supabase service-role key is required');
    this.baseUrl = `${config.url.replace(/\/$/, '')}/rest/v1/iz_payment_events`;
    this.fetcher = config.fetcher ?? fetch;
  }

  async record(event: PaymentEvent): Promise<boolean> {
    const response = await this.fetcher(this.baseUrl, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        id: event.id,
        kind: event.kind,
        payment_intent_id: event.paymentIntentId,
        external_transaction_id: event.externalTransactionId,
        provider: event.provider,
        fingerprint: event.fingerprint,
        created_at: event.createdAt,
      }),
    });

    if (response.status === 409) return false;
    if (!response.ok) throw new Error(`Supabase payment event insert failed: HTTP ${response.status}`);
    return true;
  }

  async hasFingerprint(fingerprint: string): Promise<boolean> {
    const url = `${this.baseUrl}?fingerprint=eq.${encodeURIComponent(fingerprint)}&select=fingerprint&limit=1`;
    const response = await this.fetcher(url, { method: 'GET', headers: this.headers() });
    if (!response.ok) throw new Error(`Supabase payment event lookup failed: HTTP ${response.status}`);
    const rows = await response.json() as Array<{ fingerprint: string }>;
    return rows.length > 0;
  }

  private headers(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    headers.set('apikey', this.config.serviceRoleKey);
    headers.set('Authorization', `Bearer ${this.config.serviceRoleKey}`);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    return headers;
  }
}
