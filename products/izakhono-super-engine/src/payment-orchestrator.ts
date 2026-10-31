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

export interface PaymentOrchestratorConfig { merchantId: string; serviceId: string; }

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

  async recordPaid(payment: PaymentIntent, config: PaymentOrchestratorConfig): Promise<boolean> {
    this.assertMerchant(config.merchantId);
    if (payment.status !== 'paid') throw new Error('Only paid payments can enter the payment fabric');
    const first = await this.events.record(createPaymentEvent({ kind: 'payment.paid', paymentIntentId: payment.id, externalTransactionId: payment.externalTransactionId, provider: payment.provider, fingerprint: `payment.paid:${payment.id}` }));
    if (!first) return false;
    await this.ledger.recordPayment({ paymentIntentId: payment.id, merchantId: config.merchantId, amountMinor: payment.amountMinor, currency: payment.currency });
    return true;
  }

  async fulfillPaid(payment: PaymentIntent, config: PaymentOrchestratorConfig): Promise<FulfillmentJob> {
    this.assertMerchant(config.merchantId);
    if (payment.status !== 'paid') throw new Error('Only paid payments can be fulfilled');
    return this.fulfillment.enqueue(payment, config);
  }

  async executeFulfillment(job: FulfillmentJob, payment: PaymentIntent): Promise<FulfillmentJob> { return this.fulfillment.execute(job, payment); }
  async reconcilePayment(input: { payment: PaymentIntent; observedAmountMinor: number; observedCurrency: string }): Promise<ReconciliationRecord> {
    return this.reconciliation.reconcile({ provider: input.payment.provider, externalTransactionId: input.payment.externalTransactionId, expectedAmountMinor: input.payment.amountMinor, observedAmountMinor: input.observedAmountMinor, currency: input.observedCurrency });
  }
  async createSettlement(input: { merchantId: string; currency: string; amountMinor: number; transactionReferences: readonly string[] }): Promise<SettlementBatch> { this.assertMerchant(input.merchantId); return this.settlement.create(input); }
  async recordSettlement(input: { settlement: SettlementBatch; merchantPayableAccountId: string; settlementAccountId?: string }): Promise<void> { await this.settlementLedger.recordSettlement(input); }
  async markSettlementSettled(id: string): Promise<SettlementBatch> { return this.settlement.markSettled(id); }

  async refund(payment: PaymentIntent, config: PaymentOrchestratorConfig, reason = 'Customer refund', amountMinor?: number): Promise<RefundLedgerResult & { payment: PaymentIntent; providerRefundId: string }> {
    this.assertMerchant(config.merchantId);
    if (payment.status !== 'paid') throw new Error(`Refund requires a paid payment; current status is ${payment.status}`);
    if (!payment.providerPaymentId) throw new Error('Paid payment has no provider payment ID');
    const amount = amountMinor ?? payment.amountMinor;
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > payment.amountMinor) throw new Error('Refund amount must be a positive integer not exceeding the payment amount');
    await this.events.record(createPaymentEvent({ kind: 'refund.requested', paymentIntentId: payment.id, externalTransactionId: payment.externalTransactionId, provider: payment.provider, fingerprint: `refund.requested:${payment.id}:${amount}:${reason}` }));
    const providerRefund = await this.refunds.refund(payment, reason, amount);
    const ledger = await this.refundLedger.recordRefund({ refundId: providerRefund.providerRefundId, payment: providerRefund.payment, merchantId: config.merchantId, amountMinor: amount });
    await this.events.record(createPaymentEvent({ kind: 'payment.refunded', paymentIntentId: payment.id, externalTransactionId: payment.externalTransactionId, provider: payment.provider, fingerprint: `payment.refunded:${payment.id}:${providerRefund.providerRefundId}` }));
    return { ...ledger, payment: providerRefund.payment, providerRefundId: providerRefund.providerRefundId };
  }

  /** Reconciles an ambiguous refund through a provider lookup only; it never submits another refund request. */
  async reconcileRefund(payment: PaymentIntent, config: PaymentOrchestratorConfig, amountMinor = payment.amountMinor): Promise<RefundLedgerResult & { payment: PaymentIntent; providerRefundId: string }> {
    this.assertMerchant(config.merchantId);
    if (!this.refundRecovery) throw new Error('Durable refund operations are required for provider reconciliation');
    const operation = await this.refundRecovery.reconcile(payment, amountMinor);
    if (operation.status === 'failed') throw new Error('Provider reconciliation confirmed that the refund was not completed');
    if (operation.status !== 'succeeded' || !operation.providerRefundId) throw new Error('Refund reconciliation did not produce a confirmed provider refund');
    const updatedPayment = amountMinor === payment.amountMinor ? await this.lifecycle.refund(payment, 'Refund recovered after provider outcome reconciliation') : payment;
    const ledger = await this.refundLedger.recordRefund({ refundId: operation.providerRefundId, payment: updatedPayment, merchantId: config.merchantId, amountMinor });
    await this.events.record(createPaymentEvent({ kind: 'payment.refunded', paymentIntentId: payment.id, externalTransactionId: payment.externalTransactionId, provider: payment.provider, fingerprint: `payment.refunded:${payment.id}:${operation.providerRefundId}` }));
    return { ...ledger, payment: updatedPayment, providerRefundId: operation.providerRefundId };
  }

  async issueReceipt(payment: PaymentIntent): Promise<boolean> {
    if (payment.status !== 'paid' && payment.status !== 'refunded') throw new Error('Receipt requires a paid or refunded payment');
    return this.events.record(createPaymentEvent({ kind: 'receipt.issued', paymentIntentId: payment.id, externalTransactionId: payment.externalTransactionId, provider: payment.provider, fingerprint: `receipt.issued:${payment.id}` }));
  }

  private assertMerchant(merchantId: string): void { if (!merchantId.trim()) throw new Error('Merchant ID is required'); }
}
