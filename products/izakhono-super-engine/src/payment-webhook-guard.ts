import type { PaymentIntent, PaymentProvider, PaymentStore } from './payment-core.js';
import { createPaymentEvent, type PaymentEventStore } from './payment-events.js';

/**
 * Verifies the provider signature before parsing, then claims one webhook outcome
 * per external transaction. Exact duplicates are harmless; contradictory outcomes
 * are rejected before the payment state can be changed.
 */
export class PaymentWebhookGuard {
  constructor(
    private readonly payments: PaymentStore,
    private readonly events: PaymentEventStore,
    private readonly provider: PaymentProvider,
  ) {}

  async process(rawBody: string, callbackPath: string, signature: string): Promise<PaymentIntent> {
    if (!(await this.provider.verifyWebhook(rawBody, callbackPath, signature))) {
      throw new Error('Invalid payment webhook signature');
    }

    const webhook = this.provider.parseWebhook(rawBody);
    const intent = await this.payments.getByExternalTransactionId(webhook.externalTransactionId);
    if (!intent) throw new Error('Unknown payment transaction');

    const outcome = `${webhook.status}:${webhook.responseCode}:${webhook.providerPaymentId}`;
    const claimFingerprint = `webhook:${webhook.provider}:${webhook.externalTransactionId}`;
    const outcomeFingerprint = `webhook-outcome:${webhook.provider}:${webhook.externalTransactionId}:${outcome}`;

    const claimed = await this.events.record(createPaymentEvent({
      kind: 'webhook.received',
      paymentIntentId: intent.id,
      externalTransactionId: webhook.externalTransactionId,
      provider: webhook.provider,
      fingerprint: claimFingerprint,
    }));

    if (!claimed) {
      if (await this.events.hasFingerprint(outcomeFingerprint)) return intent;
      throw new Error('Contradictory duplicate payment webhook rejected');
    }

    await this.events.record(createPaymentEvent({
      kind: 'webhook.received',
      paymentIntentId: intent.id,
      externalTransactionId: webhook.externalTransactionId,
      provider: webhook.provider,
      fingerprint: outcomeFingerprint,
    }));

    const status = webhook.status === 'SUCCESS' && webhook.responseCode === '00' ? 'paid' : 'failed';
    return this.payments.update(intent.id, {
      status,
      providerPaymentId: webhook.providerPaymentId,
    });
  }
}
