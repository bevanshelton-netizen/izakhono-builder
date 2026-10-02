import {
  PLANS,
  calculatePlatformFee,
  priceUsage,
  validateApp,
  validateDeveloper,
  validateUsage,
} from '../src/builder-economy-control-plane';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(Object.keys(PLANS).join(',') === 'free,pro,team,business,enterprise', 'plan ladder mismatch');
assert(validateDeveloper({ id: 'dev_1', email: 'builder@example.com', displayName: 'Builder', plan: 'pro' }).length === 0, 'developer validation failed');
assert(validateApp({ appId: 'app_1', developerId: 'dev_1', name: 'Store', slug: 'my-store', stage: 'building' }).length === 0, 'app validation failed');
assert(validateApp({ appId: 'app_1', developerId: 'dev_1', name: 'Store', slug: 'Bad Slug', stage: 'building' }).includes('slug must be 2-63 lowercase URL-safe characters'), 'slug validation failed');
assert(validateUsage({ appId: 'app_1', developerId: 'dev_1', metric: 'api_calls', quantity: 10 }).includes('eventId is required'), 'idempotency validation failed');
assert(validateUsage({ eventId: 'evt_1', appId: 'app_1', developerId: 'dev_1', metric: 'api_calls', quantity: 10, idempotencyKey: 'u_1' }).length === 0, 'usage validation failed');
assert(JSON.stringify(calculatePlatformFee(10000, 1000)) === JSON.stringify({ platformFeeMinor: 1000, sellerNetMinor: 9000 }), 'fee calculation failed');
assert(priceUsage({ priceId: 'p', productId: 'runtime', plan: 'pro', currency: 'ZAR', unit: 'api_call', amountMinor: 0, includedQuantity: 100, overageAmountMinor: 2 }, 125) === 50, 'usage pricing failed');

console.log('Builder economy control-plane tests passed');
