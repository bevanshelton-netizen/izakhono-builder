import type { PaymentIntent, PaymentStatus, PaymentStore } from './payment-core.js';

export interface PaymentStateEvent {
  paymentIntentId: string;
  from: PaymentStatus;
  to: PaymentStatus;
  reason: string;
  createdAt: string;
}

export interface PaymentStateEventStore {
  append(event: PaymentStateEvent): Promise<void>;
  list(paymentIntentId: string): Promise<readonly PaymentStateEvent[]>;
}

export class MemoryPaymentStateEventStore implements PaymentStateEventStore {
  private readonly events = new Map<string, PaymentStateEvent[]>();

  async append(event: PaymentStateEvent): Promise<void> {
    const current = this.events.get(event.paymentIntentId) ?? [];
    current.push({ ...event });
    this.events.set(event.paymentIntentId, current);
  }

  async list(paymentIntentId: string): Promise<readonly PaymentStateEvent[]> {
    return [...(this.events.get(paymentIntentId) ?? [])];
  }
}

export class PaymentLifecycle {
  constructor(private readonly store: PaymentStore, private readonly events: PaymentStateEventStore) {}

  async cancel(payment: PaymentIntent, reason = 'Cancelled before completion'): Promise<PaymentIntent> {
    if (payment.status === 'cancelled') return payment;
    if (payment.status === 'paid' || payment.status === 'refunded') throw new Error('Paid payments require refund flow');
    if (payment.status !== 'created' && payment.status !== 'pending' && payment.status !== 'failed') {
      throw new Error(`Payment cannot be cancelled from status ${payment.status}`);
    }
    return this.transition(payment, 'cancelled', reason);
  }

  async refund(payment: PaymentIntent, reason = 'Customer refund'): Promise<PaymentIntent> {
    if (payment.status === 'refunded') return payment;
    if (payment.status !== 'paid') throw new Error(`Only paid payments can be refunded; current status is ${payment.status}`);
    return this.transition(payment, 'refunded', reason);
  }

  private async transition(payment: PaymentIntent, to: PaymentStatus, reason: string): Promise<PaymentIntent> {
    const updated = await this.store.update(payment.id, { status: to });
    await this.events.append({
      paymentIntentId: payment.id,
      from: payment.status,
      to,
      reason,
      createdAt: new Date().toISOString(),
    });
    return updated;
  }
}

export interface RefundProvider {
  requestRefund(input: { providerPaymentId: string; amountMinor: number; currency: string; reason: string }): Promise<{ providerRefundId: string }>;
}

/** Provider-independent refund orchestration. Ledger reversal should be a separate journal transaction. */
export class IzakhonoRefunds {
  constructor(private readonly lifecycle: PaymentLifecycle, private readonly provider: RefundProvider) {}

  async refund(payment: PaymentIntent, reason = 'Customer refund'): Promise<{ payment: PaymentIntent; providerRefundId: string }> {
    if (payment.status !== 'paid') throw new Error('Refund requires a paid payment');
    if (!payment.providerPaymentId) throw new Error('Paid payment has no provider payment ID');
    const result = await this.provider.requestRefund({
      providerPaymentId: payment.providerPaymentId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      reason,
    });
    const updated = await this.lifecycle.refund(payment, reason);
    return { payment: updated, providerRefundId: result.providerRefundId };
  }
}
