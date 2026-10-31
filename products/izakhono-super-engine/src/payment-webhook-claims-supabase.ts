export type PaymentWebhookClaim = {
  provider: string;
  externalTransactionId: string;
  outcomeFingerprint: string;
  paymentIntentId: string;
};

export type WebhookClaimResult = 'claimed' | 'duplicate' | 'conflict';

export interface PaymentWebhookClaimStore {
  claim(input: PaymentWebhookClaim): Promise<WebhookClaimResult>;
}

export type SupabasePaymentWebhookClaimStoreConfig = {
  url: string;
  serviceRoleKey: string;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

/** Durable, atomic webhook claim store. The database primary key serializes concurrent workers. */
export class SupabasePaymentWebhookClaimStore implements PaymentWebhookClaimStore {
  private readonly baseUrl: string;
  private readonly fetcher: NonNullable<SupabasePaymentWebhookClaimStoreConfig['fetcher']>;

  constructor(private readonly config: SupabasePaymentWebhookClaimStoreConfig) {
    if (!config.url.trim()) throw new Error('Supabase URL is required');
    if (!config.serviceRoleKey.trim()) throw new Error('Supabase service-role key is required');
    this.baseUrl = `${config.url.replace(/\/$/, '')}/rest/v1/iz_payment_webhook_claims`;
    this.fetcher = config.fetcher ?? fetch;
  }

  async claim(input: PaymentWebhookClaim): Promise<WebhookClaimResult> {
    const response = await this.fetcher(this.baseUrl, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        provider: input.provider,
        external_transaction_id: input.externalTransactionId,
        outcome_fingerprint: input.outcomeFingerprint,
        payment_intent_id: input.paymentIntentId,
      }),
    });
    if (response.ok) return 'claimed';
    if (response.status !== 409) throw new Error(`Supabase webhook claim failed: HTTP ${response.status}`);

    const lookupUrl = `${this.baseUrl}?provider=eq.${encodeURIComponent(input.provider)}&external_transaction_id=eq.${encodeURIComponent(input.externalTransactionId)}&select=outcome_fingerprint&limit=1`;
    const lookup = await this.fetcher(lookupUrl, { method: 'GET', headers: this.headers() });
    if (!lookup.ok) throw new Error(`Supabase webhook claim lookup failed: HTTP ${lookup.status}`);
    const rows = await lookup.json() as Array<{ outcome_fingerprint: string }>;
    if (!rows.length) throw new Error('Supabase webhook claim conflict could not be resolved');
    return rows[0].outcome_fingerprint === input.outcomeFingerprint ? 'duplicate' : 'conflict';
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
