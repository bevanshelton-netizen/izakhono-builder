import type { CreatePaymentInput, PaymentProvider, ProviderPaymentResult, ProviderPaymentStatus } from './types';

/** Deterministic sandbox provider. Never moves real money. */
export class IzakhonoSandboxProvider implements PaymentProvider {
  readonly name = 'izakhono_sandbox';

  async createPayment(input: CreatePaymentInput): Promise<ProviderPaymentResult> {
    return {
      provider: this.name,
      status: 'pending',
      providerReference: `sandbox_${input.paymentId}`,
      checkoutUrl: `${input.returnUrl || '/pay'}/sandbox/${encodeURIComponent(input.paymentId)}`,
      raw: { sandbox: true, amount: input.amount, currency: input.currency }
    };
  }

  async refund(input: { paymentId: string; providerReference?: string; amount: number }) {
    return { status: 'accepted' as const, providerReference: `sandbox_refund_${input.paymentId}`, raw: { sandbox: true } };
  }

  async verifyWebhook(request: Request, rawBody: string) {
    return request.headers.get('x-izakhono-sandbox') === 'true' && rawBody.length > 0;
  }

  parseWebhook(rawBody: string) {
    try {
      const b = JSON.parse(rawBody) as Record<string, unknown>;
      const status = String(b.status || '') as ProviderPaymentStatus;
      if (!b.payment_id || !['pending','authorised','failed','reversed','refunded','settled','disputed'].includes(status)) return null;
      return { paymentId: String(b.payment_id), status, providerReference: b.provider_reference ? String(b.provider_reference) : undefined, eventId: b.event_id ? String(b.event_id) : undefined };
    } catch { return null; }
  }
}
