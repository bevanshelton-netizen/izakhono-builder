import { randomUUID } from 'node:crypto';
import { newProvisioningRecord, transition } from './state-machine.mjs';

/**
 * Store contract: createOrGetByIdempotencyKey(record) must be an atomic insert-or-read
 * backed by a UNIQUE constraint on idempotency_key. It returns:
 *   { outcome: 'created' | 'existing' | 'conflict', record }
 * An existing record is equivalent only when its payment identity and order terms match.
 */
export class PaidProvisioningBridge {
  constructor(store) {
    if (!store || typeof store.createOrGetByIdempotencyKey !== 'function') {
      throw new Error('A durable atomic provisioning store is required');
    }
    this.store = store;
  }

  async acceptPaidPayment({ payment, order }) {
    if (!payment || payment.status !== 'paid') {
      throw new Error('Provisioning requires a verified paid payment');
    }
    if (!order || !order.customerId || !order.domain || !order.idempotencyKey) {
      throw new Error('Customer, domain and checkout idempotency key are required');
    }
    if (!Number.isSafeInteger(order.expectedAmountMinor) || order.expectedAmountMinor <= 0) {
      throw new Error('Expected order amount must be a positive integer in minor currency units');
    }
    if (!Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0 ||
        payment.amountMinor !== order.expectedAmountMinor) {
      throw new Error('Payment amount does not match the order');
    }
    const expectedCurrency = String(order.currency || '').toUpperCase();
    const paidCurrency = String(payment.currency || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(expectedCurrency) || paidCurrency !== expectedCurrency) {
      throw new Error('Payment currency does not match the order');
    }
    if (!payment.id || !payment.externalTransactionId || !payment.provider || !payment.providerPaymentId) {
      throw new Error('Verified payment identity is incomplete');
    }

    const now = new Date().toISOString();
    const paymentEvidence = {
      payment_intent_id: payment.id,
      external_transaction_id: payment.externalTransactionId,
      provider: payment.provider,
      provider_payment_id: payment.providerPaymentId,
      amount_minor: payment.amountMinor,
      currency: paidCurrency,
      verified_at: now,
    };
    const planned = newProvisioningRecord({
      id: `prov_${randomUUID().replaceAll('-', '')}`,
      customerId: order.customerId,
      domain: order.domain,
      idempotencyKey: order.idempotencyKey,
    });
    const verified = transition(planned, 'PAYMENT_VERIFIED', { payment: paymentEvidence });
    verified.payment = paymentEvidence;
    verified.order_amount_minor = order.expectedAmountMinor;
    verified.order_currency = expectedCurrency;

    const result = await this.store.createOrGetByIdempotencyKey(verified);
    if (!result || !['created', 'existing', 'conflict'].includes(result.outcome)) {
      throw new Error('Provisioning store returned an invalid idempotency result');
    }
    if (result.outcome === 'conflict') {
      throw new Error('Checkout idempotency key is already bound to a different payment or order');
    }
    if (!result.record || result.record.state !== 'PAYMENT_VERIFIED' ||
        result.record.payment?.payment_intent_id !== payment.id ||
        result.record.payment?.external_transaction_id !== payment.externalTransactionId ||
        result.record.payment?.amount_minor !== payment.amountMinor ||
        result.record.payment?.currency !== paidCurrency ||
        result.record.customer_id !== order.customerId ||
        result.record.domain !== String(order.domain).toLowerCase()) {
      throw new Error('Existing provisioning record does not match the verified payment');
    }
    return { created: result.outcome === 'created', record: result.record };
  }
}
