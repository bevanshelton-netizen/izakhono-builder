export type BusinessEnginePlan = 'START' | 'GROW' | 'PRO' | 'ENTERPRISE';

export type CheckoutContext = {
  commercialOrderId: string;
  plan: BusinessEnginePlan;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

/** Provider-neutral boundary. Concrete providers must remain reversible and must
 * never mark a commercial order paid from a browser redirect. Verified gateway
 * events are the only activation authority. */
export interface BusinessEnginePaymentProvider {
  readonly name: string;
  createCheckout(context: CheckoutContext): Promise<{ reference: string; url: string }>;
  verifyWebhook(rawBody: string, signature: string): boolean;
  extractEvent(payload: unknown): {
    eventId: string;
    eventType: string;
    commercialOrderId: string | null;
    providerReference: string | null;
  };
}

export function paymentProviderName(): string {
  return process.env.BUSINESS_ENGINE_PAYMENT_PROVIDER || 'stripe';
}
