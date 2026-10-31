export type RefundOperationStatus = 'requested' | 'processing' | 'succeeded' | 'failed';

export type RefundOperation = {
  id: string;
  paymentIntentId: string;
  refundId: string;
  amountMinor: number;
  currency: string;
  status: RefundOperationStatus;
  providerRefundId?: string;
  reason: string;
};

export type RefundOperationReservation =
  | { kind: 'reserved'; operation: RefundOperation }
  | { kind: 'succeeded'; operation: RefundOperation }
  | { kind: 'active'; operation: RefundOperation };

export interface RefundOperationStore {
  reserve(input: Omit<RefundOperation, 'id' | 'status' | 'providerRefundId'>): Promise<RefundOperationReservation>;
  markSucceeded(refundId: string, providerRefundId: string): Promise<RefundOperation>;
  markFailed(refundId: string): Promise<RefundOperation>;
}

export type SupabaseRefundOperationStoreConfig = {
  url: string;
  serviceRoleKey: string;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

/** Durable refund serialization. Database uniqueness decides which worker owns a refund. */
export class SupabaseRefundOperationStore implements RefundOperationStore {
  private readonly baseUrl: string;
  private readonly fetcher: NonNullable<SupabaseRefundOperationStoreConfig['fetcher']>;

  constructor(private readonly config: SupabaseRefundOperationStoreConfig) {
    if (!config.url.trim()) throw new Error('Supabase URL is required');
    if (!config.serviceRoleKey.trim()) throw new Error('Supabase service-role key is required');
    this.baseUrl = `${config.url.replace(/\/$/, '')}/rest/v1/iz_payment_refund_operations`;
    this.fetcher = config.fetcher ?? fetch;
  }

  async reserve(input: Omit<RefundOperation, 'id' | 'status' | 'providerRefundId'>): Promise<RefundOperationReservation> {
    const operation: RefundOperation = { ...input, id: `refundop_${crypto.randomUUID()}`, status: 'processing' };
    const response = await this.fetcher(this.baseUrl, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        id: operation.id,
        payment_intent_id: operation.paymentIntentId,
        refund_id: operation.refundId,
        amount_minor: operation.amountMinor,
        currency: operation.currency,
        status: 'processing',
        reason: operation.reason,
      }),
    });
    if (response.ok) {
      const rows = await response.json() as Array<Record<string, unknown>>;
      return { kind: 'reserved', operation: this.fromRow(rows[0] ?? {}) };
    }
    if (response.status !== 409) throw new Error(`Supabase refund reservation failed: HTTP ${response.status}`);

    const existing = await this.getByRefundId(input.refundId);
    if (!existing) throw new Error('Refund reservation conflict could not be resolved');
    if (existing.paymentIntentId !== input.paymentIntentId || existing.amountMinor !== input.amountMinor || existing.currency !== input.currency) {
      throw new Error('Refund ID is already bound to different refund parameters');
    }
    if (existing.status === 'succeeded') return { kind: 'succeeded', operation: existing };
    return { kind: 'active', operation: existing };
  }

  async markSucceeded(refundId: string, providerRefundId: string): Promise<RefundOperation> {
    if (!providerRefundId.trim()) throw new Error('Provider refund ID is required');
    return this.update(refundId, { status: 'succeeded', provider_refund_id: providerRefundId }, 'processing');
  }

  async markFailed(refundId: string): Promise<RefundOperation> {
    return this.update(refundId, { status: 'failed' }, 'processing');
  }

  private async getByRefundId(refundId: string): Promise<RefundOperation | undefined> {
    const url = `${this.baseUrl}?refund_id=eq.${encodeURIComponent(refundId)}&select=*&limit=1`;
    const response = await this.fetcher(url, { method: 'GET', headers: this.headers() });
    if (!response.ok) throw new Error(`Supabase refund lookup failed: HTTP ${response.status}`);
    const rows = await response.json() as Array<Record<string, unknown>>;
    return rows[0] ? this.fromRow(rows[0]) : undefined;
  }

  private async update(refundId: string, patch: Record<string, unknown>, expectedStatus: RefundOperationStatus): Promise<RefundOperation> {
    const url = `${this.baseUrl}?refund_id=eq.${encodeURIComponent(refundId)}&status=eq.${expectedStatus}`;
    const response = await this.fetcher(url, {
      method: 'PATCH',
      headers: this.headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error(`Supabase refund operation update failed: HTTP ${response.status}`);
    const rows = await response.json() as Array<Record<string, unknown>>;
    if (rows[0]) return this.fromRow(rows[0]);

    const current = await this.getByRefundId(refundId);
    if (!current) throw new Error('Refund operation not found');
    if (current.status === patch.status) return current;
    throw new Error(`Refund operation state changed concurrently; expected ${expectedStatus}`);
  }

  private fromRow(row: Record<string, unknown>): RefundOperation {
    return {
      id: String(row.id),
      paymentIntentId: String(row.payment_intent_id),
      refundId: String(row.refund_id),
      amountMinor: Number(row.amount_minor),
      currency: String(row.currency),
      status: String(row.status) as RefundOperationStatus,
      providerRefundId: row.provider_refund_id == null ? undefined : String(row.provider_refund_id),
      reason: String(row.reason),
    };
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
