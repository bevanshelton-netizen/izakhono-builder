export function providerIdentityMatches(intent, provider, data) {
  if (!intent || !data || intent.routed_provider !== provider || !intent.app_slug || !intent.id) return false;
  if (provider === 'paystack') {
    return String(data.reference || '') === String(intent.reference || '') &&
      String(data.metadata?.intent_id || '') === String(intent.id) &&
      String(data.metadata?.app_slug || '').toLowerCase() === String(intent.app_slug).toLowerCase();
  }
  if (provider === 'payfast') {
    return String(data.m_payment_id || '') === String(intent.reference || '') &&
      String(data.custom_str1 || '').toLowerCase() === String(intent.app_slug).toLowerCase() &&
      String(data.custom_str2 || '') === String(intent.id);
  }
  if (provider === 'ikhokha') {
    return String(data.externalTransactionID || '') === String(intent.reference || '') &&
      String(data.externalEntityID || '').toLowerCase() === String(intent.app_slug).toLowerCase();
  }
  return false;
}
