# IZAKHONO PAY

**One payment layer. Many businesses.**

IZAKHONO PAY is being built as an African merchant payment-orchestration platform in the scope of products such as Paystack: merchants integrate once with IZAKHONO PAY while regulated banks, acquirers and payment partners provide the underlying movement of funds until IZAKHONO is separately authorised for any regulated activity it intends to conduct itself.

## Current v1 foundation

- Supabase PostgreSQL merchant, payment-intent, transaction and double-entry ledger tables
- Per-merchant API-key authentication with hashed secrets
- Idempotent `payment-intents` API
- Sandbox payment confirmation for safe end-to-end testing
- Merchant summary API with transaction metrics
- Test payment-link creation and public payment-link lookup
- Merchant onboarding application intake
- Webhook endpoint registration with one-time signing-secret issuance
- Fail-closed live-processing gate
- No raw card-number storage
- Provider-neutral merchant-facing contract
- Existing provider strategy: iKhokha primary candidate rail, PayFast/Paystack and future regulated rails behind adapters

## API base

`https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-payment-health`

### Health

`GET /health`

Returns runtime, provider configuration state and the live-payment gate. The current service explicitly reports `livePayments: false` until the regulated settlement path is configured and authorised.

### Payment intents

`POST /v1/payment-intents`

Headers:

- `x-api-key: <merchant API key>`
- `idempotency-key: <unique order key>`
- `content-type: application/json`

Example:

```json
{
  "amount_minor": 49900,
  "currency": "ZAR",
  "description": "Uniform order",
  "customer_email": "buyer@example.com"
}
```

`GET /v1/payment-intents/:reference` returns the payment state.

Test-only confirmation:

`POST /v1/payment-intents/:reference/sandbox-confirm`

This creates a sandbox transaction and ledger entries. It does not move real money.

### Merchant console

`GET /v1/merchant/summary`

Returns merchant profile, transaction metrics, recent transactions and payment links for the authenticated merchant.

### Payment links

`POST /v1/payment-links` creates a test-mode link for an authenticated merchant.

`GET /v1/payment-links/:slug` returns a public, non-secret payment-link representation.

### Merchant onboarding

`POST /v1/merchant-applications` accepts an initial business application. It deliberately does not collect identity documents, bank credentials or other KYB evidence in this public endpoint. KYB review remains a controlled back-office process.

### Webhooks

`POST /v1/webhook-endpoints` registers a merchant webhook URL and generates a signing secret. The raw secret is returned once; only its hash is retained by the API.

The production webhook delivery layer must sign event bodies and verify delivery/retry state before live launch.

## Data and safety boundary

IZAKHONO PAY owns the merchant-facing technology, API contract, routing layer, ledger, reconciliation, webhook orchestration and merchant experience. Phase 1 does **not** make IZAKHONO the custodian of merchant/customer funds. Live processing remains disabled until merchant KYB, applicable South African regulatory requirements, acquiring/settlement arrangements, provider credentials, webhook registration, production domain/TLS, security controls and end-to-end verification are complete.

The platform must never claim a payment is live or settled merely because an API route exists. A live transaction must be confirmed by the configured regulated payment rail and reconciled into the IZAKHONO ledger.

## Commercial direction

The intended merchant model is:

`Merchant → IZAKHONO PAY → regulated payment rail → merchant settlement`

IZAKHONO can earn a transparent platform/orchestration fee and/or negotiated processing margin where contractually and legally permitted. Marketplace splits, subscriptions, invoices, refunds, disputes, settlement reporting, fraud rules and cross-border capabilities belong behind the same merchant-facing API.

## Production roadmap

1. Merchant authentication and roles
2. KYB review workflow and merchant activation states
3. Provider adapter interface with iKhokha, PayFast, Paystack and future bank/acquirer rails
4. Signed webhooks, retries and event verification
5. Refunds, disputes and reconciliation jobs
6. Pricing/fee engine
7. Marketplace split rules and settlement reporting
8. Merchant dashboard and API-key management
9. Rate limiting, fraud/risk controls and observability
10. Regulatory/acquiring/settlement readiness for third-party live merchants
11. Production deployment and custom merchant-facing domain

## Test credentials

The repository demo uses a test-only API key embedded in the demonstration frontend. It must be removed from any public production build and replaced by authenticated merchant credentials before external merchants are enabled.
