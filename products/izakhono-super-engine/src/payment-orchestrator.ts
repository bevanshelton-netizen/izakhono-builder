import type { PaymentIntent, PaymentStore } from './payment-core.js';
import { createPaymentEvent, type PaymentEventStore } from './payment-events.js';
import { PaymentFulfillment, type FulfillmentJob, type FulfillmentStore, type ProvisionerHandler } from './payment-fulfillment.js';
import { PaymentRefundLedger, type RefundLedgerResult } from './payment-refund-ledger.js';
import { PaymentSettlementLedger } from './payment-settlement-ledger.js';
import type { IzakhonoPaymentLedger } from './payment-ledger.js';
import type { SettlementBatch, SettlementStore } from './payment-settlement.js';
import { IzakhonoReconciliation, type ReconciliationRecord, type ReconciliationStore } from './payment-reconciliation.js';
import { IzakhonoSettlement } from './payment-settlement.js';
import { IzakhonoRefunds, PaymentLifecycle, type PaymentStateEventStore, type RefundProvider } from './payment-refunds.js';
import { IzakhonoRefundRecovery } from './payment-refund-recovery.js';
import type { RefundOperationStore } from './payment-refund-operations-supabase.js';

export interface PaymentOrchestratorConfig { serviceId: string; }

/** Coordinates payment, ledger, fulfillment, reconciliation, settlement and refund transitions. */
export class PaymentOrchestrator {
  private readonly fulfillment: PaymentFulfillment;
  private readonly reconciliation: IzakhonoReconciliation;
  private readonly settlement: IzakhonoSettlement;
  private readonly settlementLedger: PaymentSettlementLedger;
  private readonly refundLedger: PaymentRefundLedger;
  private readonly lifecycle: PaymentLifecycle;
  private readonly refunds: IzakhonoRefunds;
  private readonly refundRecovery?: IzakhonoRefundRecovery;

  constructor(
    private readonly payments: PaymentStore,
    private readonly ledger: IzakhonoPaymentLedger,
    private readonly events: PaymentEventStore,
    fulfillmentStore: FulfillmentStore,
    provisioner: ProvisionerHandler,
    settlementStore: SettlementStore,
    reconciliationStore: ReconciliationStore,
    stateEvents: PaymentStateEventStore,
    private readonly refundProvider: RefundProvider,
    refundOperations?: RefundOperationStore,
  ) {
    this.fulfillment = new PaymentFulfillment(fulfillmentStore, provisioner);
    this.reconciliation = new IzakhonoReconciliation(reconciliationStore);
    this.settlement = new IzakhonoSettlement(settlementStore);
    this.settlementLedger = new PaymentSettlementLedger(ledger);
    this.refundLedger = new PaymentRefundLedger(ledger);
    this.lifecycle = new PaymentLifecycle(payments, stateEvents);
    this.refunds = new IzakhonoRefunds(this.lifecycle, refundProvider, refundOperations);
    this.refundRecovery = refundOperations ? new IzakhonoRefundRecovery(refundOperations, refundProvider) : undefined;
  }

  async recordPaid(candidate: PaymentIntent): Promise<boolean> {
    const payment = await this.canonicalPaid(candidate);
    const first = await this.events.record(createPaymentEvent({ kind: 'payment.paid', paymentIntentId: payment.id, externalTransactionId: payment.externalTransactionId, provider: payment.provider, fingerprint: `payment.paid:${payment.id}` }));
    if (!first) return false;
    await this.ledger.recordPayment({ paymentIntentId: payment.id, merchantId: payment.merchantId, amountMinor: payment.amountMinor, currency: payment.currency });
    return true;
  }

  async fulfillPaid(candidate: PaymentIntent, config: PaymentOrchestratorConfig): Promise<FulfillmentJob> {
    const payment = await this.canonicalPaid(candidate);
    this.assertService(config.serviceId);
    return this.fulfillment.enqueue(payment, config);
  }

  async executeFulfillment(job: FulfillmentJob, candidate: PaymentIntent): Promise<FulfillmentJob> {
    const payment = await this.canonicalPaid(candidate);
    return this.fulfillment.execute(job, payment);
  }
  async reconcilePayment(input: { payment: PaymentIntent; observedAmountMinor: number; observedCurrency: string }): Promise<ReconciliationRecord> {
    const payment = await this.payments.getById(input.payment.id);
    if (!payment || payment.id !== input.payment.id || !payment.merchantId?.trim()) throw new Error('Canonical payment intent not found');
    return this.reconciliation.reconcile({ provider: payment.provider, externalTransactionId: payment.externalTransactionId, expectedAmountMinor: payment.amountMinor, observedAmountMinor: input.observedAmountMinor, currency: input.observedCurrency });
  }
  async createSettlement(input: { merchantId: string; currency: string; amountMinor: number; transactionReferences: readonly string[] }): Promise<SettlementBatch> { this.assertMerchant(input.merchantId); return this.settlement.create(input); }
  async recordSettlement(input: { settlement: SettlementBatch; merchantPayableAccountId: string; settlementAccountId?: string }): Promise<void> { await this.settlementLedger.recordSettlement(input); }
  async markSettlementSettled(id: string): Promise<SettlementBatch> { return this.settlement.markSettled(id); }

  async refund(payment: PaymentIntent, config: PaymentOrchestratorConfig, reason = 'Customer refund', amountMinor?: number): Promise<RefundLedgerResult & { payment: PaymentIntent; providerRefundId: string }> {
    const canonical = await this.canonicalPaid(payment);
    this.assertService(config.serviceId);
    if (!canonical.providerPaymentId) throw new Error('Paid payment has no provider payment ID');
    const amount = amountMinor ?? canonical.amountMinor;
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > canonical.amountMinor) throw new Error('Refund amount must be a positive integer not exceeding the payment amount');
    await this.events.record(createPaymentEvent({ kind: 'refund.requested', paymentIntentId: canonical.id, externalTransactionId: canonical.externalTransactionId, provider: canonical.provider, fingerprint: `refund.requested:${canonical.id}:${amount}:${reason}` }));
    const providerRefund = await this.refunds.refund(canonical, reason, amount);
    const ledger = await this.refundLedger.recordRefund({ refundId: providerRefund.providerRefundId, payment: providerRefund.payment, amountMinor: amount });
    await this.events.record(createPaymentEvent({ kind: 'payment.refunded', paymentIntentId: canonical.id, externalTransactionId: canonical.externalTransactionId, provider: canonical.provider, fingerprint: `payment.refunded:${canonical.id}:${providerRefund.providerRefundId}` }));
    return { ...ledger, payment: providerRefund.payment, providerRefundId: providerRefund.providerRefundId };
  }

  /** Reconciles an ambiguous refund through a provider lookup only; it never submits another refund request. */
  async reconcileRefund(payment: PaymentIntent, config: PaymentOrchestratorConfig, amountMinor = payment.amountMinor): Promise<RefundLedgerResult & { payment: PaymentIntent; providerRefundId: string }> {
    const canonical = await this.canonicalPaid(payment);
    this.assertService(config.serviceId);
    if (!this.refundRecovery) throw new Error('Durable refund operations are required for provider reconciliation');
    const operation = await this.refundRecovery.reconcile(canonical, amountMinor);
    if (operation.status === 'failed') throw new Error('Provider reconciliation confirmed that the refund was not completed');
    if (operation.status !== 'succeeded' || !operation.providerRefundId) throw new Error('Refund reconciliation did not produce a confirmed provider refund');
    const updatedPayment = amountMinor === canonical.amountMinor ? await this.lifecycle.refund(canonical, 'Refund recovered after provider outcome reconciliation') : canonical;
    const ledger = await this.refundLedger.recordRefund({ refundId: operation.providerRefundId, payment: updatedPayment, amountMinor });
    await this.events.record(createPaymentEvent({ kind: 'payment.refunded', paymentIntentId: canonical.id, externalTransactionId: canonical.externalTransactionId, provider: canonical.provider, fingerprint: `payment.refunded:${canonical.id}:${operation.providerRefundId}` }));
    return { ...ledger, payment: updatedPayment, providerRefundId: operation.providerRefundId };
  }

  async issueReceipt(candidate: PaymentIntent): Promise<boolean> {
    const payment = await this.payments.getById(candidate.id);
    if (!payment || payment.id !== candidate.id || !payment.merchantId?.trim()) throw new Error('Canonical payment intent not found');
    if (payment.status !== 'paid' && payment.status !== 'refunded') throw new Error('Receipt requires a paid or refunded payment');
    return this.events.record(createPaymentEvent({ kind: 'receipt.issued', paymentIntentId: payment.id, externalTransactionId: payment.externalTransactionId, provider: payment.provider, fingerprint: `receipt.issued:${payment.id}` }));
  }

  private async canonicalPaid(candidate: PaymentIntent): Promise<PaymentIntent> {
    const payment = await this.payments.getById(candidate.id);
    if (!payment || payment.id !== candidate.id) throw new Error('Canonical payment intent not found');
    if (payment.status !== 'paid') throw new Error('Only canonically paid payments can enter this operation');
    if (!payment.merchantId?.trim()) throw new Error('Payment intent has no trusted merchant identity');
    return payment;
  }

  private assertService(serviceId: string): void { if (!serviceId?.trim()) throw new Error('Service ID is required'); }
}
