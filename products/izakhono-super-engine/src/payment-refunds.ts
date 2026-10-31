import type { PaymentIntent, PaymentStatus, PaymentStore } from './payment-core.js';
import type { RefundOperationStore } from './payment-refund-operations-supabase.js';

export interface PaymentStateEvent { paymentIntentId: string; from: PaymentStatus; to: PaymentStatus; reason: string; createdAt: string; }
export interface PaymentStateEventStore { append(event: PaymentStateEvent): Promise<void>; list(paymentIntentId: string): Promise<readonly PaymentStateEvent[]>; }
export class MemoryPaymentStateEventStore implements PaymentStateEventStore {
  private readonly events = new Map<string, PaymentStateEvent[]>();
  async append(event: PaymentStateEvent): Promise<void> { const current = this.events.get(event.paymentIntentId) ?? []; current.push({ ...event }); this.events.set(event.paymentIntentId, current); }
  async list(paymentIntentId: string): Promise<readonly PaymentStateEvent[]> { return [...(this.events.get(paymentIntentId) ?? [])]; }
}
export class PaymentLifecycle {
  constructor(private readonly store: PaymentStore, private readonly events: PaymentStateEventStore) {}
  async cancel(payment: PaymentIntent, reason = 'Cancelled before completion'): Promise<PaymentIntent> {
    if (payment.status === 'cancelled') return payment;
    if (payment.status === 'paid' || payment.status === 'refunded') throw new Error('Paid payments require refund flow');
    if (payment.status !== 'created' && payment.status !== 'pending' && payment.status !== 'failed') throw new Error(`Payment cannot be cancelled from status ${payment.status}`);
    return this.transition(payment, 'cancelled', reason);
  }
  async refund(payment: PaymentIntent, reason = 'Customer refund'): Promise<PaymentIntent> {
    if (payment.status === 'refunded') return payment;
    if (payment.status !== 'paid') throw new Error(`Only paid payments can be refunded; current status is ${payment.status}`);
    return this.transition(payment, 'refunded', reason);
  }
  private async transition(payment: PaymentIntent, to: PaymentStatus, reason: string): Promise<PaymentIntent> {
    const updated = this.store.updateIfStatus ? await this.store.updateIfStatus(payment.id, payment.status, { status: to }) : await this.store.update(payment.id, { status: to });
    if (!updated) { const current = await this.store.getByExternalTransactionId(payment.externalTransactionId); if (current?.status === to) return current; throw new Error(`Payment state changed concurrently; expected ${payment.status}`); }
    await this.events.append({ paymentIntentId: payment.id, from: payment.status, to, reason, createdAt: new Date().toISOString() });
    return updated;
  }
}
export interface RefundProvider {
  requestRefund(input: { providerPaymentId: string; amountMinor: number; currency: string; reason: string; refundId?: string }): Promise<{ providerRefundId: string }>;
}
/** Durable operations serialize workers. Ambiguous provider outcomes are quarantined for reconciliation. */
export class IzakhonoRefunds {
  private readonly inFlight = new Map<string, Promise<{ payment: PaymentIntent; providerRefundId: string }>>();
  constructor(private readonly lifecycle: PaymentLifecycle, private readonly provider: RefundProvider, private readonly operations?: RefundOperationStore) {}
  async refund(payment: PaymentIntent, reason = 'Customer refund', amountMinor = payment.amountMinor): Promise<{ payment: PaymentIntent; providerRefundId: string }> {
    const key = `${payment.id}:${amountMinor}`; const existing = this.inFlight.get(key); if (existing) return existing;
    const operation = this.executeRefund(payment, reason, amountMinor); this.inFlight.set(key, operation);
    try { return await operation; } finally { if (this.inFlight.get(key) === operation) this.inFlight.delete(key); }
  }
  private async executeRefund(payment: PaymentIntent, reason: string, amountMinor: number): Promise<{ payment: PaymentIntent; providerRefundId: string }> {
    if (payment.status !== 'paid') throw new Error('Refund requires a paid payment');
    if (!payment.providerPaymentId) throw new Error('Paid payment has no provider payment ID');
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > payment.amountMinor) throw new Error('Refund amount must be a positive integer not exceeding the payment amount');
    const refundId = `refund:${payment.id}:${amountMinor}`;
    if (this.operations) {
      const reservation = await this.operations.reserve({ paymentIntentId: payment.id, refundId, amountMinor, currency: payment.currency, reason });
      if (reservation.kind === 'succeeded') { const providerRefundId = reservation.operation.providerRefundId; if (!providerRefundId) throw new Error('Succeeded refund operation has no provider refund ID'); return { payment: amountMinor === payment.amountMinor ? await this.lifecycle.refund(payment, reason) : payment, providerRefundId }; }
      if (reservation.kind === 'active') throw new Error('Refund is already being processed');
      if (reservation.kind === 'reconciliation-required') throw new Error('Refund requires provider reconciliation before another external attempt');
    }
    let result: { providerRefundId: string };
    try { result = await this.provider.requestRefund({ providerPaymentId: payment.providerPaymentId, amountMinor, currency: payment.currency, reason, refundId }); }
    catch (error) {
      if (this.operations) {
        try { await this.operations.markReconciliationRequired(refundId, error instanceof Error ? error.message : String(error)); } catch { /* preserve the original provider error; durable reconciliation can retry lookup */ }
      }
      throw error;
    }
    if (this.operations) await this.operations.markSucceeded(refundId, result.providerRefundId);
    return { payment: amountMinor === payment.amountMinor ? await this.lifecycle.refund(payment, reason) : payment, providerRefundId: result.providerRefundId };
  }
}
