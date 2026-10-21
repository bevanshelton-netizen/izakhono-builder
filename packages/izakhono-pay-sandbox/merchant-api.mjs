import { createSandboxMerchant, issueSandboxKey, simulatePayment } from './index.mjs';

const merchants = new Map();
const idempotency = new Map();

export function registerMerchant(id) {
  const merchant = createSandboxMerchant({ id });
  merchants.set(id, { merchant, api_key: issueSandboxKey(id) });
  return merchants.get(id);
}

export function authenticate(apiKey) {
  for (const record of merchants.values()) if (record.api_key === apiKey) return record.merchant;
  throw new Error('Invalid sandbox API key');
}

export function createPayment({ apiKey, amountMinor, currency = 'ZAR', scenario = 'approved', idempotencyKey }) {
  const merchant = authenticate(apiKey);
  const key = `${merchant.id}:${idempotencyKey}`;
  if (idempotency.has(key)) return { ...idempotency.get(key), idempotent_replay: true };
  const payment = simulatePayment({ scenario, amountMinor, currency, idempotencyKey });
  const result = { merchant_id: merchant.id, ...payment };
  idempotency.set(key, result);
  return result;
}

export function getSandboxState() {
  return { merchant_count: merchants.size, idempotency_records: idempotency.size, funds_movement: 'none' };
}
