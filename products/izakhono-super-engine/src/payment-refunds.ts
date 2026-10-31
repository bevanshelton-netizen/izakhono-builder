import type { PaymentIntent, PaymentStatus, PaymentStore } from './payment-core.js';
import type { RefundOperationStore } from './payment-refund-operations-supabase.js';

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
    const updated = this.store.updateIfStatus
      ? await this.store.updateIfStatus(payment.id, payment.status, { status: to })
      : await this.store.update(payment.id, { status: to });
    if (!updated) {
      const current = await this.store.getByExternalTransactionId(payment.externalTransactionId);
      if (current?.status === to) return current;
      throw new Error(`Payment state changed concurrently; expected ${payment.status}`);
    }
    await this.events.append({ paymentIntentId: payment.id, from: payment.status, to, reason, createdAt: new Date().toISOString() });
    return updated;
  }
}

export interface RefundProvider {
  requestRefund(input: { providerPaymentId: string; amountMinor: number; currency: string; reason: string }): Promise<{ providerRefundId: string }>;
}

/** Provider-independent refund orchestration. Durable operations serialize workers; provider idempotency remains a provider capability. */
export class IzakhonoRefunds {
  private readonly inFlight = new Map<string, Promise<{ payment: PaymentIntent; providerRefundId: string }>>();

  constructor(
    private readonly lifecycle: PaymentLifecycle,
    private readonly provider: RefundProvider,
    private readonly operations?: RefundOperationStore,
  ) {}

  async refund(payment: PaymentIntent, reason = 'Customer refund'): Promise<{ payment: PaymentIntent; providerRefundId: string }> {
    const existing = this.inFlight.get(payment.id);
    if (existing) return existing;
    const operation = this.executeRefund(payment, reason);
    this.inFlight.set(payment.id, operation);
    try { return await operation; }
    finally { if (this.inFlight.get(payment.id) === operation) this.inFlight.delete(payment.id); }
  }

  private async executeRefund(payment: PaymentIntent, reason: string): Promise<{ payment: PaymentIntent; providerRefundId: string }> {
    if (payment.status !== 'paid') throw new Error('Refund requires a paid payment');
    if (!payment.providerPaymentId) throw new Error('Paid payment has no provider payment ID');

    const refundId = `refund:${payment.id}`;
    if (this.operations) {
      const reservation = await this.operations.reserve({
        paymentIntentId: payment.id,
        refundId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        reason,
      });
      if (reservation.kind === 'succeeded') {
        const updated = await this.lifecycle.refund(payment, reason);
        if (!reservation.operation.providerRefundId) throw new Error('Succeeded refund operation has no provider refund ID');
        return { payment: updated, providerRefundId: reservation.operation.providerRefundId };
      }
      if (reservation.kind === 'active') throw new Error('Refund is already being processed');
    }

    try {
      const result = await this.provider.requestRefund({ providerPaymentId: payment.providerPaymentId, amountMinor: payment.amountMinor, currency: payment.currency, reason });
      if (this.operations) await this.operations.markSucceeded(refundId, result.providerRefundId);
      const updated = await this.lifecycle.refund(payment, reason);
      return { payment: updated, providerRefundId: result.providerRefundId };
    } catch (error) {
      if (this.operations) {
        try { await this.operations.markFailed(refundId); } catch { /* preserve original failure; reconciliation can inspect the operation */ }
      }
      throw error;
    }
  }
}
