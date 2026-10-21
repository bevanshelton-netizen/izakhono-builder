/**
 * IZAKHONO PAY Control Plane reference engine.
 *
 * Provider-agnostic orchestration primitives: merchant isolation, deterministic
 * routing, idempotency, payment state transitions, ledger events and
 * reconciliation. This module does not hold funds and does not replace
 * regulated payment/settlement functions.
 */

export const PAYMENT_STATES = Object.freeze([
  'created',
  'requires_action',
  'processing',
  'paid',
  'failed',
  'cancelled',
  'refunded'
]);

const TRANSITIONS = Object.freeze({
  created: new Set(['requires_action', 'processing', 'cancelled', 'failed']),
  requires_action: new Set(['processing', 'paid', 'failed', 'cancelled']),
  processing: new Set(['paid', 'failed', 'cancelled']),
  paid: new Set(['refunded']),
  failed: new Set(['processing', 'cancelled']),
  cancelled: new Set(),
  refunded: new Set()
});

export function assertMoney(amountMinor, currency = 'ZAR') {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('amount_minor must be a positive integer');
  if (!/^[A-Z]{3}$/.test(String(currency))) throw new Error('currency must be an ISO-style 3-letter code');
  return { amount_minor: amountMinor, currency: String(currency) };
}

export function createIdempotencyFingerprint(input) {
  const canonical = JSON.stringify({
    merchant: input.merchant,
    amount_minor: input.amount_minor,
    currency: input.currency,
    customer: input.customer,
    description: input.description,
    provider: input.provider || 'smart',
    metadata: input.metadata || {}
  });
  return canonical;
}

export function transitionPayment(payment, nextState, at = new Date().toISOString()) {
  if (!PAYMENT_STATES.includes(nextState)) throw new Error(`Unknown payment state: ${nextState}`);
  const allowed = TRANSITIONS[payment.status] || new Set();
  if (!allowed.has(nextState)) throw new Error(`Invalid payment transition ${payment.status} -> ${nextState}`);
  return { ...payment, status: nextState, updated_at: at };
}

export class ProviderRegistry {
  #providers = new Map();

  register(provider) {
    if (!provider?.id || !provider?.currencies?.length || typeof provider.health !== 'function') {
      throw new Error('Provider requires id, currencies and health()');
    }
    this.#providers.set(provider.id, Object.freeze({ ...provider, currencies: [...provider.currencies] }));
    return this;
  }

  get(id) { return this.#providers.get(id) || null; }

  list() { return [...this.#providers.values()].map(({ id, priority, currencies }) => ({ id, priority, currencies: [...currencies] })); }

  healthy(currency, requested = 'smart') {
    const code = String(currency).toUpperCase();
    return [...this.#providers.values()]
      .filter((p) => p.currencies.includes(code) && p.health())
      .filter((p) => requested === 'smart' || p.id === requested)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  route(currency, requested = 'smart') {
    const candidate = this.healthy(currency, requested)[0];
    return candidate?.id || null;
  }
}

export class IdempotencyStore {
  #records = new Map();

  put(scope, key, fingerprint, result) {
    const compound = `${scope}:${key}`;
    const existing = this.#records.get(compound);
    if (existing && existing.fingerprint !== fingerprint) {
      throw new Error('idempotency key reuse detected with different request fingerprint');
    }
    if (existing) return { replay: true, result: existing.result };
    this.#records.set(compound, { fingerprint, result });
    return { replay: false, result };
  }
}

export class Ledger {
  #entries = [];

  append(entry) {
    assertMoney(entry.amount_minor, entry.currency);
    if (!entry.payment_id || !entry.type) throw new Error('ledger entry requires payment_id and type');
    const record = Object.freeze({
      id: entry.id || `led_${this.#entries.length + 1}`,
      payment_id: entry.payment_id,
      merchant: entry.merchant,
      type: entry.type,
      amount_minor: entry.amount_minor,
      currency: entry.currency,
      provider: entry.provider || null,
      external_reference: entry.external_reference || null,
      created_at: entry.created_at || new Date().toISOString()
    });
    this.#entries.push(record);
    return record;
  }

  forPayment(paymentId) { return this.#entries.filter((entry) => entry.payment_id === paymentId); }

  balance(paymentId) {
    return this.forPayment(paymentId).reduce((sum, entry) => {
      if (entry.type === 'credit' || entry.type === 'refund_debit') return sum + entry.amount_minor;
      if (entry.type === 'debit' || entry.type === 'refund_credit') return sum - entry.amount_minor;
      return sum;
    }, 0);
  }

  all() { return [...this.#entries]; }
}

export function reconcileProviderRecord({ payment, providerStatus, providerReference, amountMinor, currency }) {
  const expected = assertMoney(payment.amount_minor, payment.currency);
  const observed = assertMoney(amountMinor, currency);
  const statusMatches = String(providerStatus).toLowerCase() === 'paid';
  const amountMatches = expected.amount_minor === observed.amount_minor;
  const currencyMatches = expected.currency === observed.currency;
  const referencePresent = Boolean(providerReference);
  return {
    ok: statusMatches && amountMatches && currencyMatches && referencePresent,
    status_matches: statusMatches,
    amount_matches: amountMatches,
    currency_matches: currencyMatches,
    reference_present: referencePresent,
    action: statusMatches && amountMatches && currencyMatches && referencePresent ? 'settle' : 'hold_for_review'
  };
}

export function buildDefaultProviderRegistry() {
  return new ProviderRegistry()
    .register({ id: 'ikhokha', priority: 10, currencies: ['ZAR'], health: () => true })
    .register({ id: 'paystack', priority: 20, currencies: ['ZAR', 'NGN', 'GHS', 'KES'], health: () => true })
    .register({ id: 'payfast', priority: 30, currencies: ['ZAR'], health: () => true });
}
