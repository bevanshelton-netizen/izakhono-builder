import type { HostCheckoutOrder } from './host-provisioner-adapter.js';

export interface ImmutableCheckoutOrder extends HostCheckoutOrder {
  orderId: string;
  paymentIntentId: string;
  externalTransactionId: string;
  productId: string;
  createdAt: string;
}

export interface CreateCheckoutOrderInput extends ImmutableCheckoutOrder {}

export interface CheckoutOrderStore {
  createOrGet(input: CreateCheckoutOrderInput): Promise<ImmutableCheckoutOrder>;
  getByPaymentIntentId(paymentIntentId: string): Promise<ImmutableCheckoutOrder | undefined>;
}

/** Durable Supabase/PostgREST implementation. Database uniqueness and an immutable-row trigger are authoritative. */
export class SupabaseCheckoutOrderStore implements CheckoutOrderStore {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;

  constructor(private readonly config: { url: string; serviceRoleKey: string; fetcher?: typeof fetch }) {
    if (!config.url.trim() || !config.serviceRoleKey.trim()) throw new Error('Supabase URL and service-role key are required');
    this.endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/iz_checkout_orders`;
    this.fetcher = config.fetcher ?? fetch;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('apikey', this.config.serviceRoleKey);
    headers.set('Authorization', `Bearer ${this.config.serviceRoleKey}`);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    const response = await this.fetcher(url, { ...init, headers });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Checkout order store failed: HTTP ${response.status}${detail ? ` ${detail.slice(0, 300)}` : ''}`);
    }
    return response;
  }

  async createOrGet(input: CreateCheckoutOrderInput): Promise<ImmutableCheckoutOrder> {
    validateOrder(input);
    const payload = {
      order_id: input.orderId,
      payment_intent_id: input.paymentIntentId,
      external_transaction_id: input.externalTransactionId,
      customer_id: input.customerId,
      domain: input.domain,
      expected_amount_minor: input.expectedAmountMinor,
      currency: input.currency,
      idempotency_key: input.idempotencyKey,
      product_id: input.productId,
      created_at: input.createdAt,
    };
    const response = await this.request(this.endpoint, {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(payload),
    });
    const inserted = await response.json() as CheckoutOrderRow[];
    if (inserted[0]) return fromRow(inserted[0]);

    // A uniqueness collision is only an idempotent retry if every immutable field matches.
    const existing = await this.findByUniqueKeys(input);
    if (!existing) throw new Error('Checkout order uniqueness conflict could not be resolved');
    if (!sameOrder(existing, input)) throw new Error('Conflicting reuse of checkout order, payment or idempotency identity');
    return existing;
  }

  async getByPaymentIntentId(paymentIntentId: string): Promise<ImmutableCheckoutOrder | undefined> {
    if (!paymentIntentId.trim()) throw new Error('Payment intent ID is required');
    const url = `${this.endpoint}?payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=*`;
    const rows = await (await this.request(url, { method: 'GET' })).json() as CheckoutOrderRow[];
    return rows[0] ? fromRow(rows[0]) : undefined;
  }

  private async findByUniqueKeys(input: CreateCheckoutOrderInput): Promise<ImmutableCheckoutOrder | undefined> {
    for (const [field, value] of [
      ['order_id', input.orderId],
      ['payment_intent_id', input.paymentIntentId],
      ['external_transaction_id', input.externalTransactionId],
      ['idempotency_key', input.idempotencyKey],
    ] as const) {
      const url = `${this.endpoint}?${field}=eq.${encodeURIComponent(value)}&select=*`;
      const rows = await (await this.request(url, { method: 'GET' })).json() as CheckoutOrderRow[];
      if (rows[0]) return fromRow(rows[0]);
    }
    return undefined;
  }
}

interface CheckoutOrderRow {
  order_id: string; payment_intent_id: string; external_transaction_id: string;
  customer_id: string; domain: string; expected_amount_minor: number; currency: string;
  idempotency_key: string; product_id: string; created_at: string;
}

function validateOrder(order: CreateCheckoutOrderInput): void {
  for (const [name, value] of Object.entries({
    orderId: order.orderId, paymentIntentId: order.paymentIntentId,
    externalTransactionId: order.externalTransactionId, customerId: order.customerId,
    domain: order.domain, idempotencyKey: order.idempotencyKey, productId: order.productId,
  })) if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  if (!Number.isSafeInteger(order.expectedAmountMinor) || order.expectedAmountMinor <= 0) throw new Error('Expected amount must be a positive integer in minor units');
  if (!/^[A-Z]{3}$/.test(order.currency)) throw new Error('Currency must be an uppercase ISO 4217 code');
  const domain = order.domain.toLowerCase().replace(/\.$/, '');
  if (domain !== order.domain || domain.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error('Domain must be a normalized public DNS hostname');
  }
  if (!Number.isFinite(Date.parse(order.createdAt))) throw new Error('Created timestamp must be valid ISO date text');
}

function sameOrder(a: ImmutableCheckoutOrder, b: CreateCheckoutOrderInput): boolean {
  return a.orderId === b.orderId && a.paymentIntentId === b.paymentIntentId &&
    a.externalTransactionId === b.externalTransactionId && a.customerId === b.customerId &&
    a.domain === b.domain && a.expectedAmountMinor === b.expectedAmountMinor &&
    a.currency === b.currency && a.idempotencyKey === b.idempotencyKey &&
    a.productId === b.productId && a.createdAt === b.createdAt;
}

function fromRow(row: CheckoutOrderRow): ImmutableCheckoutOrder {
  return {
    orderId: row.order_id, paymentIntentId: row.payment_intent_id,
    externalTransactionId: row.external_transaction_id, customerId: row.customer_id,
    domain: row.domain, expectedAmountMinor: row.expected_amount_minor,
    currency: row.currency, idempotencyKey: row.idempotency_key,
    productId: row.product_id, createdAt: row.created_at,
  };
}
