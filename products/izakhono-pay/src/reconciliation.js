import { sha256Hex } from './core.js';

function text(value, max = 255) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function money(value, label) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error(`${label} must be an integer in minor units`);
  return amount;
}

export function normalizeSettlement(input = {}) {
  const provider = text(input.provider, 40).toLowerCase();
  const appSlug = text(input.app_slug, 80).toLowerCase();
  const providerReference = text(input.provider_reference, 180);
  const merchantReference = text(input.merchant_reference, 180);
  const currency = text(input.currency || 'ZAR', 3).toUpperCase();
  const amountMinor = money(input.amount_minor, 'amount_minor');
  const feeMinor = input.fee_minor == null ? 0 : money(input.fee_minor, 'fee_minor');
  const netMinor = input.net_minor == null ? amountMinor - feeMinor : money(input.net_minor, 'net_minor');
  const settledAt = text(input.settled_at, 64);

  if (!provider) throw new Error('provider is required');
  if (!appSlug) throw new Error('app_slug is required');
  if (!providerReference && !merchantReference) throw new Error('provider_reference or merchant_reference is required');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency must be a three-letter code');
  if (amountMinor <= 0) throw new Error('amount_minor must be positive');
  if (feeMinor < 0) throw new Error('fee_minor may not be negative');
  if (netMinor < 0 || netMinor > amountMinor) throw new Error('net_minor must be between zero and amount_minor');

  const fingerprint = sha256Hex(JSON.stringify({
    provider,
    appSlug,
    providerReference,
    merchantReference,
    currency,
    amountMinor,
    feeMinor,
    netMinor,
    settledAt,
  }));

  return {
    provider,
    app_slug: appSlug,
    provider_reference: providerReference || null,
    merchant_reference: merchantReference || null,
    amount_minor: amountMinor,
    fee_minor: feeMinor,
    net_minor: netMinor,
    currency,
    settled_at: settledAt || null,
    fingerprint,
  };
}

export function normalizeIntentForReconciliation(intent = {}) {
  return {
    id: text(intent.id, 160),
    app_slug: text(intent.app_slug, 80).toLowerCase(),
    reference: text(intent.reference, 180),
    provider_reference: text(intent.provider_reference, 180) || null,
    amount_minor: money(intent.amount_minor, 'intent.amount_minor'),
    currency: text(intent.currency, 3).toUpperCase(),
    status: text(intent.status, 40).toLowerCase(),
  };
}

function exactAmountAndCurrency(settlement, intent) {
  return settlement.amount_minor === intent.amount_minor && settlement.currency === intent.currency;
}

function unique(list) {
  return [...new Map(list.map(item => [item.id, item])).values()];
}

export function reconcileSettlement(settlementInput, intentInputs = []) {
  const settlement = normalizeSettlement(settlementInput);
  const intents = intentInputs.map(normalizeIntentForReconciliation)
    .filter(intent => intent.id && intent.app_slug === settlement.app_slug);

  const providerMatches = settlement.provider_reference
    ? unique(intents.filter(intent => intent.provider_reference && intent.provider_reference === settlement.provider_reference))
    : [];
  const merchantMatches = settlement.merchant_reference
    ? unique(intents.filter(intent => intent.reference === settlement.merchant_reference))
    : [];

  const referenceMatches = unique([...providerMatches, ...merchantMatches]);
  if (referenceMatches.length > 1) {
    return {
      settlement,
      status: 'review',
      reason: 'ambiguous_reference',
      match_type: null,
      intent: null,
      difference_minor: null,
    };
  }

  if (referenceMatches.length === 1) {
    const intent = referenceMatches[0];
    if (!exactAmountAndCurrency(settlement, intent)) {
      return {
        settlement,
        status: 'review',
        reason: settlement.currency !== intent.currency ? 'currency_mismatch' : 'amount_mismatch',
        match_type: providerMatches.some(item => item.id === intent.id) ? 'provider_reference' : 'merchant_reference',
        intent,
        difference_minor: settlement.amount_minor - intent.amount_minor,
      };
    }

    return {
      settlement,
      status: 'matched',
      reason: null,
      match_type: providerMatches.some(item => item.id === intent.id) ? 'provider_reference' : 'merchant_reference',
      intent,
      difference_minor: 0,
    };
  }

  return {
    settlement,
    status: 'review',
    reason: 'reference_not_found',
    match_type: null,
    intent: null,
    difference_minor: null,
  };
}

export function reconcileBatch(settlementInputs = [], intentInputs = []) {
  if (!Array.isArray(settlementInputs)) throw new Error('settlements must be an array');
  if (!Array.isArray(intentInputs)) throw new Error('intents must be an array');
  if (settlementInputs.length > 5000) throw new Error('reconciliation batch may not exceed 5000 settlement records');

  const seen = new Set();
  const results = [];
  for (const input of settlementInputs) {
    const settlement = normalizeSettlement(input);
    if (seen.has(settlement.fingerprint)) {
      results.push({
        settlement,
        status: 'duplicate',
        reason: 'duplicate_fingerprint',
        match_type: null,
        intent: null,
        difference_minor: null,
      });
      continue;
    }
    seen.add(settlement.fingerprint);
    results.push(reconcileSettlement(settlement, intentInputs));
  }

  return {
    results,
    summary: results.reduce((out, result) => {
      out.total += 1;
      out[result.status] = (out[result.status] || 0) + 1;
      if (result.status === 'matched') {
        out.matched_amount_minor += result.settlement.amount_minor;
        out.matched_net_minor += result.settlement.net_minor;
        out.matched_fee_minor += result.settlement.fee_minor;
      }
      return out;
    }, {
      total: 0,
      matched: 0,
      review: 0,
      duplicate: 0,
      matched_amount_minor: 0,
      matched_net_minor: 0,
      matched_fee_minor: 0,
    }),
  };
}

export const reconciliationCapabilities = Object.freeze({
  deterministicReferenceMatching: true,
  exactAmountAndCurrencyRequired: true,
  idempotentSettlementFingerprint: true,
  automaticFuzzyMatching: false,
  amountOnlyMatching: false,
  autoSettlement: false,
  fundCustody: false,
});
