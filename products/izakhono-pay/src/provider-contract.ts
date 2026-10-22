export type PaymentMethod = 'card'|'instant_eft'|'wallet'|'bank_transfer'|'qr'|'payshap'|'other';

export interface PaymentRequest {
  paymentId: string;
  merchantId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  returnUrl?: string;
  metadata?: Record<string,string>;
}

export interface ProviderResult {
  accepted: boolean;
  provider: string;
  providerReference?: string;
  redirectUrl?: string;
  status: 'pending'|'authorised'|'failed';
  raw?: unknown;
}

export interface PaymentProviderAdapter {
  readonly name: string;
  readonly methods: readonly PaymentMethod[];
  createPayment(request: PaymentRequest): Promise<ProviderResult>;
  getPayment(providerReference: string): Promise<ProviderResult>;
  refundPayment(providerReference: string, amount: number, currency: string): Promise<ProviderResult>;
  verifyWebhook(request: Request): Promise<Record<string,unknown>>;
}

/**
 * IZAKHONO owns this contract. Providers are capacity adapters and can be
 * added, removed or replaced without changing the merchant API.
 */
export const PROVIDER_POLICY = {
  primary: 'best-available',
  failover: 'policy-controlled',
  settlement: 'regulated-provider',
  custody: 'regulated-provider',
  audit: 'izakhono-ledger'
} as const;
