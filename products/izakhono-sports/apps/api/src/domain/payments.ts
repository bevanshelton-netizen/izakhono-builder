export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export type CheckoutRequest = {
  reference: string;
  amount: number;
  currency: string;
  purpose: string;
  metadata?: Record<string, unknown>;
};

export type CheckoutResult = {
  provider: string;
  providerReference: string;
  checkoutUrl?: string;
  status: PaymentStatus;
};

export interface PaymentAdapter {
  createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
  verifyPayment(providerReference: string): Promise<{ status: PaymentStatus; amount?: number; currency?: string }>;
  issueRefund(providerReference: string, amount?: number): Promise<{ status: PaymentStatus }>;
  createSubscription(input: CheckoutRequest & { planCode: string }): Promise<CheckoutResult>;
  cancelSubscription(providerReference: string): Promise<{ status: 'cancelled' }>;
  receiveWebhook(payload: unknown, headers: Record<string, string | undefined>): Promise<{ eventId: string; eventType: string; status: PaymentStatus; providerReference?: string }>;
}

export class MockPaymentAdapter implements PaymentAdapter {
  async createCheckout(input: CheckoutRequest): Promise<CheckoutResult> {
    return { provider: 'mock', providerReference: `mock_${input.reference}`, checkoutUrl: `/pay/mock/${encodeURIComponent(input.reference)}`, status: 'pending' };
  }
  async verifyPayment(providerReference: string) { return { status: providerReference.startsWith('mock_') ? 'paid' as const : 'failed' as const }; }
  async issueRefund(_providerReference: string, _amount?: number) { return { status: 'refunded' as const }; }
  async createSubscription(input: CheckoutRequest & { planCode: string }) { return { provider: 'mock', providerReference: `mock_sub_${input.reference}`, checkoutUrl: `/pay/mock/${encodeURIComponent(input.reference)}`, status: 'pending' as const }; }
  async cancelSubscription(_providerReference: string) { return { status: 'cancelled' as const }; }
  async receiveWebhook(payload: any) { return { eventId: String(payload?.id ?? `mock_evt_${Date.now()}`), eventType: String(payload?.type ?? 'payment.updated'), status: (payload?.status ?? 'paid') as PaymentStatus, providerReference: payload?.providerReference }; }
}

export function paymentAdapter(provider = process.env.PAYMENT_PROVIDER || 'mock'): PaymentAdapter {
  if (provider === 'mock') return new MockPaymentAdapter();
  throw new Error(`Payment provider '${provider}' is not configured`);
}
