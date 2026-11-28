import type { PaymentIntent, PaymentProvider, PaymentStore } from './payment-core.js';
import { createPaymentEvent, type PaymentEventStore } from './payment-events.js';
import type { PaymentWebhookClaimStore } from './payment-webhook-claims-supabase.js';

/** Verifies signatures first and optionally uses a durable atomic claim store for multi-instance safety. */
export class PaymentWebhookGuard {
  constructor(
    private readonly payments: PaymentStore,
    private readonly events: PaymentEventStore,
    private readonly provider: PaymentProvider,
    private readonly claims?: PaymentWebhookClaimStore,
  ) {}

  async process(rawBody: string, callbackPath: string, signature: string): Promise<PaymentIntent> {
    if (!(await this.provider.verifyWebhook(rawBody, callbackPath, signature))) {
      throw new Error('Invalid payment webhook signature');
    }

    const webhook = this.provider.parseWebhook(rawBody);
    const intent = await this.payments.getByExternalTransactionId(webhook.externalTransactionId);
    if (!intent) throw new Error('Unknown payment transaction');
    if (!intent.merchantId?.trim() || !intent.serviceId?.trim()) throw new Error('Payment intent has no trusted merchant identity or service entitlement');
    if (webhook.provider !== intent.provider) throw new Error('Payment webhook provider does not match payment intent');
    const evidence = await this.provider.verifyPaymentEvidence(webhook, intent);
    if (evidence.provider !== intent.provider || evidence.providerPaymentId !== intent.providerPaymentId || evidence.externalTransactionId !== intent.externalTransactionId) throw new Error('Provider payment evidence does not match payment intent references');
    if (!Number.isSafeInteger(evidence.amountMinor) || evidence.amountMinor !== intent.amountMinor) throw new Error('Provider payment evidence amount does not match payment intent');
    if (evidence.currency !== intent.currency) throw new Error('Provider payment evidence currency does not match payment intent');
    if (evidence.status !== webhook.status || evidence.responseCode !== webhook.responseCode) throw new Error('Provider payment evidence contradicts webhook outcome');

    const outcome = `${evidence.status}:${evidence.responseCode}:${evidence.providerPaymentId}:${evidence.amountMinor}:${evidence.currency}`;
    const outcomeFingerprint = `webhook-outcome:${webhook.provider}:${webhook.externalTransactionId}:${outcome}`;

    if (this.claims) {
      const claim = await this.claims.claim({
        provider: webhook.provider,
        externalTransactionId: webhook.externalTransactionId,
        outcomeFingerprint,
        paymentIntentId: intent.id,
      });
      if (claim === 'duplicate') return intent;
      if (claim === 'conflict') throw new Error('Contradictory duplicate payment webhook rejected');
    } else {
      const claimFingerprint = `webhook:${webhook.provider}:${webhook.externalTransactionId}`;
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
        kind: 'webhook.outcome',
        paymentIntentId: intent.id,
        externalTransactionId: webhook.externalTransactionId,
        provider: webhook.provider,
        fingerprint: outcomeFingerprint,
      }));
    }

    const status = evidence.status === 'SUCCESS' && evidence.responseCode === '00' ? 'paid' : 'failed';
    if (intent.status === 'paid' && status === 'paid') return intent;
    if (intent.status !== 'pending') throw new Error(`Payment webhook cannot transition intent from ${intent.status}`);
    return this.payments.update(intent.id, { status });
  }
}
