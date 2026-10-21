import assert from 'node:assert/strict';
import { ProviderRouter, sandboxProvider } from './router.mjs';

const router = new ProviderRouter();
router.register({ name: 'primary', priority: 10, adapter: sandboxProvider('primary', 'failure') });
router.register({ name: 'backup', priority: 20, adapter: sandboxProvider('backup', 'success') });

const result = router.route({ amountMinor: 5000, currency: 'ZAR' });
assert.equal(result.status, 'succeeded');
assert.equal(result.provider, 'backup');
assert.equal(result.attempts.length, 2);
assert.equal(result.attempts[0].status, 'failed');
assert.equal(result.attempts[1].status, 'success');

router.disable('backup');
const unavailable = router.route({ amountMinor: 5000, currency: 'ZAR' });
assert.equal(unavailable.status, 'unavailable');
assert.equal(unavailable.attempts.length, 1);

console.log('IZAKHONO PAY provider routing/failover QC: GREEN');
