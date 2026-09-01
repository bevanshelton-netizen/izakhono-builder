# IZAKHONO PAY

**One checkout. Many rails.**

IZAKHONO PAY is the payment-orchestration layer for IZAKHONO products. Applications integrate once with IZAKHONO PAY; the router selects a configured provider and the unified ledger records the transaction lifecycle.

## Alpha scope

- One payment-intent API for all internal applications
- Smart routing between Paystack and PayFast for ZAR
- Paystack hosted checkout initialization
- PayFast signed Custom Integration form-post checkout
- Paystack HMAC-SHA512 webhook verification
- PayFast ITN signature, source-IP, amount and server-confirmation checks
- Idempotent provider event ledger
- Mock checkout for safe end-to-end testing
- Admin summary dashboard
- No card-number storage
- Fail-closed provider configuration

The alpha intentionally supports **ZAR checkout only**. Customers using international cards may still be accepted by a connected provider where that merchant account is enabled for those cards. True multi-currency and country-local payment rails belong in later adapters.

## Safety boundary

IZAKHONO PAY alpha is orchestration software, not a bank, acquiring institution, card network or settlement provider. It does not hold customer funds and does not accept raw card data. Production use is blocked until merchant onboarding, applicable legal/regulatory review, privacy terms, production database, TLS/domain, live provider credentials and webhook registration are complete.

## Modes

- `mock` — no real money; public simulator enabled
- `sandbox` — real provider test environments/keys only
- `live` — live provider credentials; use only after production readiness review

## Required secrets

Store with Cloudflare secrets or your deployment platform's secret manager; never commit them:

- `ADMIN_SECRET`
- `IZAKHONO_INTERNAL_API_KEY`
- `PAYSTACK_SECRET_KEY`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`

## Provider verification

Paystack webhooks are accepted only when `x-paystack-signature` matches HMAC-SHA512 of the raw body using the Paystack secret key. A successful charge must also match the stored amount and currency.

PayFast ITNs must pass all of the following before a payment can be marked paid:

1. custom-integration signature verification;
2. source IP allow-list verification;
3. expected amount comparison;
4. server-to-server validation with PayFast;
5. `payment_status=COMPLETE`.

## Database

Create a dedicated D1 database named `izakhono-pay`, replace the all-zero placeholder `database_id` in `wrangler.jsonc`, then apply `migrations/0001_core.sql` through Wrangler migrations. Do not reuse the builder database for production payment data.

## API

### Public

- `GET /api/health`
- `GET /api/v1/capabilities`
- `POST /api/webhooks/paystack`
- `POST /api/webhooks/payfast`
- mock-only demo endpoints under `/api/demo/*`

### Internal applications

`POST /api/v1/intents` with headers:

- `content-type: application/json`
- `x-izakhono-key: <IZAKHONO_INTERNAL_API_KEY>`
- optional `x-izakhono-app: <app-slug>`

Example body:

```json
{
  "amount_minor": 39900,
  "currency": "ZAR",
  "email": "customer@example.com",
  "description": "3-subject monthly plan",
  "provider": "smart"
}
```

The response returns either a hosted redirect or a PayFast `form_post` target and signed fields. An application must treat the payment as pending until the ledger reports `paid`.

## Next commercial phase

Add country/currency-specific adapters, per-merchant API keys, OAuth-style application credentials, reconciliation jobs, refund orchestration, subscriptions, disputes, settlement reporting, observability, rate limiting, fraud rules and the required South African/international payment-industry approvals before offering the service to unrelated third-party merchants.
