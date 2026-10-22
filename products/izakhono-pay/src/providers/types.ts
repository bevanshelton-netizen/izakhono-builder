export type ProviderPaymentStatus = 'pending'|'authorised'|'failed'|'reversed'|'refunded'|'settled'|'disputed';

export interface CreatePaymentInput {
  paymentId: string;
  amount: number;
  currency: string;
  description?: string;
  returnUrl?: string;
}

export interface ProviderPaymentResult {
  provider: string;
  status: ProviderPaymentStatus;
  providerReference: string;
  checkoutUrl?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<ProviderPaymentResult>;
  refund(input: { paymentId: string; providerReference?: string; amount: number }): Promise<{status: 'requested'|'accepted'; providerReference?: string; raw?: unknown}>;
  verifyWebhook(request: Request, rawBody: string): Promise<boolean>;
  parseWebhook(rawBody: string): { paymentId: string; status: ProviderPaymentStatus; providerReference?: string; eventId?: string } | null;
}

export function providerRegistry(provider: PaymentProvider) {
  return new Map<string, PaymentProvider>([[provider.name, provider]]);
}
