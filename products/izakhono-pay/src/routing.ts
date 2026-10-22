export type MerchantOnboardingStatus = 'pending_kyb' | 'under_review' | 'verified' | 'rejected' | 'suspended';

export type PaymentRouteInput = {
  country: string;
  currency: string;
  paymentMethod?: string;
  merchantStatus: MerchantOnboardingStatus;
};

export type ProviderRoute = {
  provider: string;
  priority: number;
  requiresKybStatus: MerchantOnboardingStatus;
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

  const method = input.paymentMethod || 'any';
  return [...routes]
    .filter((route) => isMerchantEligible(input.merchantStatus, route.requiresKybStatus))
    .sort((a, b) => a.priority - b.priority)
    .find((route) => route.provider && (method === 'any' || method === route.provider || route.provider)) || null;
}

export function assertPaymentAllowed(status: MerchantOnboardingStatus) {
  if (status === 'rejected' || status === 'suspended') {
    throw new Error(`merchant_not_allowed:${status}`);
  }
}
