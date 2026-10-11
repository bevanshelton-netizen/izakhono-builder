export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export interface CheckoutRequest {
  reference: string;
  amount: number;
  currency: string;
  customerEmail: string;
  description: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CheckoutResult { provider: string; checkoutUrl: string; providerReference: string; }
export interface PaymentVerification { provider: string; providerReference: string; status: PaymentStatus; amount?: number; currency?: string; }

export interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  verifyPayment(providerReference: string): Promise<PaymentVerification>;
  refundPayment(providerReference: string, amount?: number): Promise<PaymentVerification>;
}

export class PaymentRouter {
  constructor(private readonly providers: Record<string, PaymentProvider>) {}
  get(name: string): PaymentProvider {
    const provider = this.providers[name];
    if (!provider) throw new Error(`payment_provider_not_configured:${name}`);
    return provider;
  }
}

export const paymentFlows = [
  'organisation_subscription',
  'competition_registration',
  'athlete_passport_premium',
  'sponsor_marketplace_commission',
  'sponsor_analytics_premium'
] as const;
