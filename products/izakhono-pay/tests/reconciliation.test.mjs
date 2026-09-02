import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSettlement,
  reconcileBatch,
  reconcileSettlement,
  reconciliationCapabilities,
} from '../src/reconciliation.js';

const intents = [
  {
    id: 'pi_faisready_1',
    app_slug: 'faisready',
    reference: 'IZP-FAIS-001',
    provider_reference: 'PF-10001',
    amount_minor: 50000,
    currency: 'ZAR',
    status: 'paid',
  },
  {
    id: 'pi_other_1',
    app_slug: 'other-app',
    reference: 'IZP-OTHER-001',
    provider_reference: 'PF-10001',
    amount_minor: 50000,
    currency: 'ZAR',
    status: 'paid',
  },
];

test('normalizes settlement and creates stable fingerprint', () => {
  const one = normalizeSettlement({
    provider: 'PayFast',
    app_slug: 'FAISReady',
    provider_reference: 'PF-10001',
    merchant_reference: 'IZP-FAIS-001',
    amount_minor: 50000,
    fee_minor: 1250,
    currency: 'zar',
    settled_at: '2026-09-02T12:00:00Z',
  });
  const two = normalizeSettlement({
    provider: 'payfast',
    app_slug: 'faisready',
    provider_reference: 'PF-10001',
    merchant_reference: 'IZP-FAIS-001',
    amount_minor: 50000,
    fee_minor: 1250,
    net_minor: 48750,
    currency: 'ZAR',
    settled_at: '2026-09-02T12:00:00Z',
  });
  assert.equal(one.fingerprint, two.fingerprint);
  assert.equal(one.net_minor, 48750);
});

test('matches provider reference only when amount, currency and app agree', () => {
  const result = reconcileSettlement({
    provider: 'payfast',
    app_slug: 'faisready',
    provider_reference: 'PF-10001',
    amount_minor: 50000,
    fee_minor: 1250,
    currency: 'ZAR',
  }, intents);
  assert.equal(result.status, 'matched');
  assert.equal(result.match_type, 'provider_reference');
  assert.equal(result.intent.id, 'pi_faisready_1');
  assert.equal(result.difference_minor, 0);
});

test('matches merchant reference when provider reference is absent', () => {
  const result = reconcileSettlement({
    provider: 'payfast',
    app_slug: 'faisready',
    merchant_reference: 'IZP-FAIS-001',
    amount_minor: 50000,
    currency: 'ZAR',
  }, intents);
  assert.equal(result.status, 'matched');
  assert.equal(result.match_type, 'merchant_reference');
  assert.equal(result.intent.id, 'pi_faisready_1');
});

test('amount mismatch never auto-matches', () => {
  const result = reconcileSettlement({
    provider: 'payfast',
    app_slug: 'faisready',
    provider_reference: 'PF-10001',
    amount_minor: 49900,
    currency: 'ZAR',
  }, intents);
  assert.equal(result.status, 'review');
  assert.equal(result.reason, 'amount_mismatch');
  assert.equal(result.difference_minor, -100);
});

test('currency mismatch never auto-matches', () => {
  const result = reconcileSettlement({
    provider: 'payfast',
    app_slug: 'faisready',
    provider_reference: 'PF-10001',
    amount_minor: 50000,
    currency: 'USD',
  }, intents);
  assert.equal(result.status, 'review');
  assert.equal(result.reason, 'currency_mismatch');
});

test('unknown reference never falls back to amount-only matching', () => {
  const result = reconcileSettlement({
    provider: 'payfast',
    app_slug: 'faisready',
    provider_reference: 'PF-NOT-FOUND',
    amount_minor: 50000,
    currency: 'ZAR',
  }, intents);
  assert.equal(result.status, 'review');
  assert.equal(result.reason, 'reference_not_found');
  assert.equal(result.intent, null);
});

test('batch is idempotent within the feed and aggregates only deterministic matches', () => {
  const settlement = {
    provider: 'payfast',
    app_slug: 'faisready',
    provider_reference: 'PF-10001',
    amount_minor: 50000,
    fee_minor: 1250,
    currency: 'ZAR',
  };
  const result = reconcileBatch([
    settlement,
    settlement,
    {
      provider: 'payfast',
      app_slug: 'faisready',
      provider_reference: 'PF-NOT-FOUND',
      amount_minor: 50000,
      currency: 'ZAR',
    },
  ], intents);
  assert.deepEqual(result.summary, {
    total: 3,
    matched: 1,
    review: 1,
    duplicate: 1,
    matched_amount_minor: 50000,
    matched_net_minor: 48750,
    matched_fee_minor: 1250,
  });
});

test('zero-touch capability contract stays non-custodial and non-fuzzy', () => {
  assert.equal(reconciliationCapabilities.deterministicReferenceMatching, true);
  assert.equal(reconciliationCapabilities.exactAmountAndCurrencyRequired, true);
  assert.equal(reconciliationCapabilities.idempotentSettlementFingerprint, true);
  assert.equal(reconciliationCapabilities.automaticFuzzyMatching, false);
  assert.equal(reconciliationCapabilities.amountOnlyMatching, false);
  assert.equal(reconciliationCapabilities.autoSettlement, false);
  assert.equal(reconciliationCapabilities.fundCustody, false);
});
