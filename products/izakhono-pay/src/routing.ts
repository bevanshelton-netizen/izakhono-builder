export type MerchantOnboardingStatus = 'pending_kyb' | 'under_review' | 'verified' | 'rejected' | 'suspended';
export type ProviderEnvironment = 'sandbox' | 'production';

export type PaymentRouteInput = {
  country: string;
  currency: string;
  paymentMethod?: string;
  merchantStatus: MerchantOnboardingStatus;
  environment?: ProviderEnvironment;
  liveReady?: boolean;
};

export type ProviderRoute = {
  provider: string;
  priority: number;
  country?: string;
  currency?: string;
  paymentMethod?: string;
  requiresKybStatus: MerchantOnboardingStatus;
  environment?: ProviderEnvironment;
  enabled?: boolean;
};

const statusRank: Record<MerchantOnboardingStatus, number> = {
  pending_kyb: 0,
  under_review: 1,
  verified: 2,
  rejected: -1,
  suspended: -1,
};

export function isMerchantEligible(merchantStatus: MerchantOnboardingStatus, required: MerchantOnboardingStatus) {
  if (merchantStatus === 'rejected' || merchantStatus === 'suspended') return false;
  return statusRank[merchantStatus] >= statusRank[required];
}

export function selectProvider(routes: ProviderRoute[], input: PaymentRouteInput): ProviderRoute | null {
  if (input.merchantStatus === 'rejected' || input.merchantStatus === 'suspended') return null;

  const country = input.country.toUpperCase();
  const currency = input.currency.toUpperCase();
  const method = input.paymentMethod || 'any';
  const environment = input.environment || 'sandbox';

  return [...routes]
    .filter((route) => route.enabled !== false)
    .filter((route) => (route.environment || 'sandbox') === environment)
    .filter((route) => !route.country || route.country.toUpperCase() === country)
    .filter((route) => !route.currency || route.currency.toUpperCase() === currency)
    .filter((route) => !route.paymentMethod || route.paymentMethod === 'any' || route.paymentMethod === method)
    .filter((route) => isMerchantEligible(input.merchantStatus, route.requiresKybStatus))
    .filter((route) => environment !== 'production' || input.liveReady === true)
    .sort((a, b) => a.priority - b.priority)[0] || null;
}

export function assertPaymentAllowed(status: MerchantOnboardingStatus) {
  if (status === 'rejected' || status === 'suspended') {
    throw new Error(`merchant_not_allowed:${status}`);
  }
}

export function assertProductionRoutingReady(environment: ProviderEnvironment, liveReady: boolean) {
  if (environment === 'production' && !liveReady) {
    throw new Error('live_readiness_required');
  }
}
