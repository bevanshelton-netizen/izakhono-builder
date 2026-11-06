-- Stage THE BUSINESS OF MUSIC as a merchant application in IZAKHONO PAY.
-- This does not activate the merchant, issue an API key, or enable live payments.
INSERT OR IGNORE INTO merchant_apps (
  id, slug, display_name, status, fortress_required, metadata_json
) VALUES (
  'm_business_of_music',
  'business-of-music',
  'THE BUSINESS OF MUSIC',
  'staged',
  1,
  '{"product":"ebook","currency":"ZAR","amount_minor":14900,"provider_preference":"ikhokha","activation":"blocked_pending_merchant_credentials_and_acceptance"}'
);
