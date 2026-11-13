import type { PaymentIntent } from './payment-core.js';
import type { FulfillmentJob, ProvisionerHandler } from './payment-fulfillment.js';

export interface HostCheckoutOrder {
  customerId: string;
  domain: string;
  expectedAmountMinor: number;
  currency: string;
  idempotencyKey: string;
}

/**
 * Server-side adapter between IZAKHONO payment fulfillment and HOST.
 * The order resolver MUST read the immutable checkout snapshot from trusted storage;
 * it must never derive price, customer or domain from a browser redirect/webhook.
 */
export interface HostProvisionerAdapterConfig {
  endpoint: string;
  bridgeToken: string;
  resolveOrder(payment: PaymentIntent, job: FulfillmentJob): Promise<HostCheckoutOrder | undefined>;
  fetcher?: typeof fetch;
}

export class HostProvisionerAdapter implements ProvisionerHandler {
  private readonly fetcher: typeof fetch;

  constructor(private readonly config: HostProvisionerAdapterConfig) {
    if (!config.endpoint.trim()) throw new Error('HOST internal endpoint is required');
    if (!config.bridgeToken.trim()) throw new Error('HOST payment bridge token is required');
    const endpoint = new URL(config.endpoint);
    if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname)) {
      throw new Error('HOST payment bridge endpoint must use HTTPS');
    }
    this.fetcher = config.fetcher ?? fetch;
  }

  async provision(input: { job: FulfillmentJob; payment: PaymentIntent }): Promise<void> {
    const { job, payment } = input;
    if (payment.status !== 'paid') throw new Error('HOST fulfillment requires a persisted paid payment');
    if (!payment.provider || !payment.providerPaymentId || !payment.externalTransactionId) {
      throw new Error('Payment provider identity is incomplete');
    }
    const order = await this.config.resolveOrder(payment, job);
    if (!order) throw new Error('Immutable checkout order snapshot was not found');
    if (!order.customerId.trim() || !order.domain.trim() || !order.idempotencyKey.trim()) {
      throw new Error('Checkout order snapshot is incomplete');
    }
    if (!Number.isSafeInteger(order.expectedAmountMinor) || order.expectedAmountMinor <= 0 ||
        order.expectedAmountMinor !== payment.amountMinor ||
        order.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      throw new Error('Persisted payment does not match immutable checkout order terms');
    }

    const response = await this.fetcher(new URL('/internal/payments/verified', this.config.endpoint), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-izakhono-payment-token': this.config.bridgeToken,
      },
      body: JSON.stringify({
        payment: {
          id: payment.id,
          status: payment.status,
          externalTransactionId: payment.externalTransactionId,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          provider: payment.provider,
          providerPaymentId: payment.providerPaymentId,
        },
        order: {
          customerId: order.customerId,
          domain: order.domain,
          expectedAmountMinor: order.expectedAmountMinor,
          currency: order.currency,
          idempotencyKey: order.idempotencyKey,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`HOST rejected paid provisioning: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 500)}` : ''}`);
    }
    const result = await response.json() as { ok?: boolean; state?: string };
    if (result.ok !== true || result.state !== 'PAYMENT_VERIFIED') {
      throw new Error('HOST did not confirm durable PAYMENT_VERIFIED acceptance');
    }
  }
}
