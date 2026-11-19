export function providerIdentityMatches(intent, provider, payload = {}) {
  if (!intent || intent.routed_provider !== provider || !payload || typeof payload !== 'object') return false;
  if (provider === 'ikhokha') {
    return String(payload.externalTransactionID || '') === String(intent.reference || '') &&
      String(payload.externalEntityID || '') === String(intent.app_slug || '');
  }
  if (provider === 'paystack') {
    let metadata = payload.metadata;
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { return false; }
    }
    return String(metadata?.intent_id || '') === String(intent.id || '') &&
      String(metadata?.app_slug || '') === String(intent.app_slug || '');
  }
  if (provider === 'payfast') {
    return String(payload.m_payment_id || '') === String(intent.reference || '') &&
      String(payload.custom_str1 || '') === String(intent.app_slug || '') &&
      String(payload.custom_str2 || '') === String(intent.id || '');
  }
  return false;
}
