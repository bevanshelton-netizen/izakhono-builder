# IZAKHONO PAY V1 Alpha

**The African Business Money Operating System**

IZAKHONO PAY owns the merchant-facing payment-intent lifecycle and provider-orchestration control plane. Regulated acquiring partners handle regulated money movement until IZAKHONO has the required authorisations and partner arrangements.

## Current Alpha capabilities

- Staged merchant registration and activation status
- Merchant-scoped payment-intent creation and retrieval
- Payment links and hosted-checkout handoff
- Idempotency keys for payment-intent creation
- Replaceable iKhokha, Paystack and PayFast adapter paths
- Signed provider webhook ingestion and provider-side payment verification
- Exact amount/currency matching before paid-state mutation
- D1-backed payment-intent and provider-event records
- Merchant API-key authentication and tenant-scoped intent access
- Signed merchant payment.paid notification records
- Sandbox mode and controlled payment simulator

**Launch boundary:** ZAR-only Alpha. Production providers remain disabled by default. No live customer payments are currently accepted.

## Not yet production-integrated

The following capabilities are separate roadmap or Super Engine components and must not be represented as live IZAKHONO PAY Worker features until integrated and independently tested:

- Double-entry merchant ledger, balances and fee postings
- Refund execution and refund-ledger integration
- Dispute and chargeback case management
- Settlement and payout orchestration
- Bank-statement reconciliation and verified settlement matching
- Recurring billing and subscription lifecycle
- Stripe and international currencies
- Durable merchant-webhook retry scheduling and delivery recovery
- Full FORTRESS operational monitoring, incident response and external security review

## Current payment flow

Merchant server → IZAKHONO PAY API → Payment Intent → Provider Adapter → Signed Provider Webhook → Provider-side Verification → D1 Payment State → Merchant Notification.

The Business Studio provisioning integration independently retrieves the authenticated merchant intent and verifies its order ID, merchant, amount, currency, paid status and provider transaction reference before authorising fulfilment.

Providers are replaceable execution adapters. IZAKHONO PAY is the merchant-facing system of record for payment-intent state; the acquiring provider remains authoritative for its own transaction and settlement records.

## Security

Never store PAN/CVV or banking credentials. Keep merchant API keys and provider secrets server-side. Require idempotency for money-moving commands. Verify signed provider webhooks and provider-side payment status before state mutation. Persist provider event fingerprints durably and recover interrupted paid-state transitions on replay. Separate sandbox from production credentials and keep all production providers disabled until approval gates are evidenced.
