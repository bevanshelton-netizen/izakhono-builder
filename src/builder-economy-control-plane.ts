export type BuilderPlan = 'free' | 'pro' | 'team' | 'business' | 'enterprise';
export type AppStage = 'idea' | 'building' | 'preview' | 'verified' | 'deployed' | 'monetizing' | 'scaled';
export type ListingKind = 'api' | 'component' | 'template' | 'agent' | 'app' | 'asset';

export const PLANS: Record<BuilderPlan, { includedBuildMinutes: number; includedApiCalls: number; includedStorageGb: number }> = {
  free: { includedBuildMinutes: 100, includedApiCalls: 10000, includedStorageGb: 1 },
  pro: { includedBuildMinutes: 1000, includedApiCalls: 250000, includedStorageGb: 25 },
  team: { includedBuildMinutes: 5000, includedApiCalls: 1000000, includedStorageGb: 100 },
  business: { includedBuildMinutes: 20000, includedApiCalls: 5000000, includedStorageGb: 500 },
  enterprise: { includedBuildMinutes: 100000, includedApiCalls: 50000000, includedStorageGb: 5000 },
};

export interface DeveloperAccount {
  id: string;
  email: string;
  displayName: string;
  plan: BuilderPlan;
  status: 'active' | 'suspended' | 'closed';
}

export interface RegisteredApp {
  appId: string;
  developerId: string;
  name: string;
  slug: string;
  stage: AppStage;
  manifest: Record<string, unknown>;
}

export interface UsageEvent {
  eventId: string;
  appId: string;
  developerId: string;
  metric: 'build_minutes' | 'runtime_compute' | 'storage_gb_month' | 'api_calls' | 'ai_tokens' | 'bandwidth_gb' | 'marketplace_gmv';
  quantity: number;
  occurredAt: string;
  idempotencyKey: string;
  billable: boolean;
}

export interface Price {
  priceId: string;
  productId: string;
  plan: BuilderPlan;
  currency: string;
  unit: string;
  amountMinor: number;
  includedQuantity: number;
  overageAmountMinor: number;
}

export interface MarketplaceListing {
  listingId: string;
  developerId: string;
  appId?: string;
  kind: ListingKind;
  name: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'suspended' | 'retired';
  pricing: Record<string, unknown>;
}

export interface CommercialEvent {
  eventId: string;
  appId?: string;
  developerId?: string;
  eventType: 'charge' | 'refund' | 'payout' | 'platform_fee' | 'adjustment';
  currency?: string;
  grossMinor: number;
  platformFeeMinor: number;
  sellerNetMinor: number;
  externalReference?: string;
  idempotencyKey: string;
}

export interface BillingProvider {
  authorize(input: {
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    reference: string;
  }): Promise<{ providerReference: string; status: 'authorized' | 'declined' }>;
  refund(input: {
    providerReference: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<{ status: 'refunded' | 'declined' }>;
}

export function validateDeveloper(input: Partial<DeveloperAccount>): string[] {
  const errors: string[] = [];
  if (!input.id?.trim()) errors.push('id is required');
  if (!input.email?.includes('@')) errors.push('valid email is required');
  if (!input.displayName?.trim()) errors.push('displayName is required');
  if (!input.plan || !Object.hasOwn(PLANS, input.plan)) errors.push('valid plan is required');
  return errors;
}

export function validateApp(input: Partial<RegisteredApp>): string[] {
  const errors: string[] = [];
  if (!input.appId?.trim()) errors.push('appId is required');
  if (!input.developerId?.trim()) errors.push('developerId is required');
  if (!input.name?.trim()) errors.push('name is required');
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(input.slug || '')) errors.push('slug must be 2-63 lowercase URL-safe characters');
  if (!input.stage) errors.push('stage is required');
  return errors;
}

export function validateUsage(input: Partial<UsageEvent>): string[] {
  const errors: string[] = [];
  if (!input.eventId?.trim()) errors.push('eventId is required');
  if (!input.appId?.trim()) errors.push('appId is required');
  if (!input.developerId?.trim()) errors.push('developerId is required');
  if (!input.metric) errors.push('metric is required');
  if (typeof input.quantity !== 'number' || !Number.isFinite(input.quantity) || input.quantity < 0) errors.push('quantity must be a finite non-negative number');
  if (!input.idempotencyKey?.trim()) errors.push('idempotencyKey is required');
  return errors;
}

export function calculatePlatformFee(grossMinor: number, basisPoints = 1000): { platformFeeMinor: number; sellerNetMinor: number } {
  if (!Number.isInteger(grossMinor) || grossMinor < 0) throw new Error('grossMinor must be a non-negative integer');
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) throw new Error('basisPoints must be between 0 and 10000');
  const platformFeeMinor = Math.floor(grossMinor * basisPoints / 10000);
  return { platformFeeMinor, sellerNetMinor: grossMinor - platformFeeMinor };
}

export function priceUsage(price: Price, quantity: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('quantity must be non-negative');
  const included = Math.max(0, price.includedQuantity);
  const overage = Math.max(0, quantity - included);
  return Math.round(overage * price.overageAmountMinor);
}
