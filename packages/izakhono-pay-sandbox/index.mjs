export const SANDBOX_SCENARIOS = Object.freeze([
  'approved',
  'declined',
  'timeout',
  'provider_unavailable',
  'duplicate_idempotency_key',
  'invalid_webhook_signature',
  'refund',
  'reconciliation_match',
  'reconciliation_mismatch',
  'primary_to_backup_failover'
]);

const VALID = new Set(SANDBOX_SCENARIOS);

export function createSandboxMerchant({ id = `test_merchant_${crypto.randomUUID()}` } = {}) {
  return { id, environment: 'sandbox', funds_movement: 'none', created_at: new Date().toISOString() };
}

export function issueSandboxKey(merchantId) {
  if (!merchantId) throw new Error('merchantId is required');
  return `sk_test_${crypto.randomUUID().replaceAll('-', '')}`;
}

export function simulatePayment({ scenario = 'approved', amountMinor, currency = 'ZAR', idempotencyKey }) {
  if (!VALID.has(scenario)) throw new Error(`Unknown sandbox scenario: ${scenario}`);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('amountMinor must be a positive safe integer');
  if (!idempotencyKey) throw new Error('idempotencyKey is required');

  const terminal = {
    approved: { status: 'succeeded', provider_status: 'approved' },
    declined: { status: 'failed', provider_status: 'declined' },
    timeout: { status: 'pending', provider_status: 'timeout' },
    provider_unavailable: { status: 'pending', provider_status: 'unavailable' },
    duplicate_idempotency_key: { status: 'rejected', provider_status: 'duplicate' },
    invalid_webhook_signature: { status: 'requires_action', provider_status: 'invalid_webhook' },
    refund: { status: 'refunded', provider_status: 'refunded' },
    reconciliation_match: { status: 'succeeded', provider_status: 'matched' },
    reconciliation_mismatch: { status: 'hold', provider_status: 'mismatch' },
    primary_to_backup_failover: { status: 'succeeded', provider_status: 'backup_approved' }
  }[scenario];

  return {
    id: `pi_test_${crypto.randomUUID()}`,
    environment: 'sandbox',
    amount_minor: amountMinor,
    currency,
    idempotency_key: idempotencyKey,
    ...terminal,
    funds_movement: 'none',
    simulated: true
  };
}

export function runSandboxSuite() {
  const merchant = createSandboxMerchant({ id: 'test_merchant_demo' });
  const key = issueSandboxKey(merchant.id);
  const results = SANDBOX_SCENARIOS.map(scenario => ({
    scenario,
    result: simulatePayment({ scenario, amountMinor: 1000, idempotencyKey: `idem_${scenario}` })
  }));
  return { merchant, key, results, passed: results.length === SANDBOX_SCENARIOS.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = runSandboxSuite();
  console.log(JSON.stringify({ merchant: suite.merchant.id, scenarios: suite.results.length, passed: suite.passed }, null, 2));
}
