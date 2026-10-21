import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IdempotencyStore,
  Ledger,
  buildDefaultProviderRegistry,
  createIdempotencyFingerprint,
  reconcileProviderRecord,
  transitionPayment
} from '../src/control-plane.js';

test('routes to the highest-priority healthy provider', () => {
  const registry = buildDefaultProviderRegistry();
  assert.equal(registry.route('ZAR'), 'ikhokha');
  assert.equal(registry.route('NGN'), 'paystack');
});

test('supports explicit provider selection without silently substituting', () => {
  const registry = buildDefaultProviderRegistry();
  assert.equal(registry.route('ZAR', 'payfast'), 'payfast');
  assert.equal(registry.route('NGN', 'payfast'), null);
});

test('rejects idempotency-key reuse with a different request', () => {
  const store = new IdempotencyStore();
  const first = { merchant: 'demo', amount_minor: 1000, currency: 'ZAR', customer: 'a@example.com' };
  const second = { ...first, amount_minor: 2000 };
  const key = 'checkout-001';
  store.put('merchant-a', key, createIdempotencyFingerprint(first), { id: 'pi_1' });
  assert.throws(() => store.put('merchant-a', key, createIdempotencyFingerprint(second), { id: 'pi_2' }), /idempotency key reuse/);
});

test('enforces payment state transitions', () => {
  const payment = { id: 'pi_1', status: 'created', updated_at: null };
  const requiresAction = transitionPayment(payment, 'requires_action', '2026-10-21T10:00:00Z');
  const processing = transitionPayment(requiresAction, 'processing', '2026-10-21T10:01:00Z');
  const paid = transitionPayment(processing, 'paid', '2026-10-21T10:02:00Z');
  assert.equal(paid.status, 'paid');
  assert.throws(() => transitionPayment(paid, 'processing'), /Invalid payment transition/);
});

test('ledger records payment and refunds deterministically', () => {
  const ledger = new Ledger();
  ledger.append({ payment_id: 'pi_1', merchant: 'demo', type: 'credit', amount_minor: 10000, currency: 'ZAR' });
  ledger.append({ payment_id: 'pi_1', merchant: 'demo', type: 'refund_debit', amount_minor: 2500, currency: 'ZAR' });
  assert.equal(ledger.balance('pi_1'), 7500);
});

test('reconciliation holds mismatched provider records', () => {
  const payment = { amount_minor: 10000, currency: 'ZAR' };
  const ok = reconcileProviderRecord({ payment, providerStatus: 'paid', providerReference: 'IK-1', amountMinor: 10000, currency: 'ZAR' });
  const mismatch = reconcileProviderRecord({ payment, providerStatus: 'paid', providerReference: 'IK-2', amountMinor: 9000, currency: 'ZAR' });
  assert.equal(ok.action, 'settle');
  assert.equal(mismatch.action, 'hold_for_review');
});
