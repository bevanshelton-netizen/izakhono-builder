import {
  PLANS,
  calculatePlatformFee,
  priceUsage,
  validateApp,
  validateDeveloper,
  validateUsage,
} from '../src/builder-economy-control-plane';

describe('builder economy control plane', () => {
  it('defines a complete plan ladder', () => {
    expect(Object.keys(PLANS)).toEqual(['free', 'pro', 'team', 'business', 'enterprise']);
  });

  it('validates developer accounts and app slugs', () => {
    expect(validateDeveloper({ id: 'dev_1', email: 'builder@example.com', displayName: 'Builder', plan: 'pro' })).toEqual([]);
    expect(validateApp({ appId: 'app_1', developerId: 'dev_1', name: 'Store', slug: 'my-store', stage: 'building' })).toEqual([]);
    expect(validateApp({ appId: 'app_1', developerId: 'dev_1', name: 'Store', slug: 'Bad Slug', stage: 'building' })).toContain('slug must be 2-63 lowercase URL-safe characters');
  });

  it('requires idempotent usage events', () => {
    expect(validateUsage({ appId: 'app_1', developerId: 'dev_1', metric: 'api_calls', quantity: 10 })).toContain('eventId is required');
    expect(validateUsage({ eventId: 'evt_1', appId: 'app_1', developerId: 'dev_1', metric: 'api_calls', quantity: 10, idempotencyKey: 'u_1' })).toEqual([]);
  });

  it('keeps marketplace economics deterministic', () => {
    expect(calculatePlatformFee(10000, 1000)).toEqual({ platformFeeMinor: 1000, sellerNetMinor: 9000 });
    expect(priceUsage({ priceId: 'p', productId: 'runtime', plan: 'pro', currency: 'ZAR', unit: 'api_call', amountMinor: 0, includedQuantity: 100, overageAmountMinor: 2 }, 125)).toBe(50);
  });
});
