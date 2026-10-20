# IZAKHONO PAY

**One payment layer. Many businesses.**

IZAKHONO PAY is being built as an African merchant payment-orchestration platform in the scope of products such as Paystack: merchants integrate once with IZAKHONO PAY while regulated banks, acquirers and payment partners provide the underlying movement of funds until IZAKHONO is separately authorised for any regulated activity it intends to conduct itself.

## Current foundation

- Merchant, payment-intent, transaction and double-entry ledger tables
- Merchant applications and controlled KYB profile model
- Per-merchant API-key authentication with hashed secrets
- Idempotent payment-intent API
- Sandbox payment confirmation for safe end-to-end testing
- Merchant summary API with transaction metrics
- Test payment-link creation and public lookup
- Webhook endpoint registration with one-time signing-secret issuance
- Fee-plan and merchant-fee assignment model
- Provider account registry and routing-rule model
- Refund, dispute and settlement-batch data models
- Immutable-style audit-event trail for merchant API actions
- Fail-closed live-processing gate
- No raw card-number storage
- Provider-neutral merchant-facing contract
- iKhokha, PayFast and Paystack represented as candidate regulated rails behind adapters

## API base

`https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-payment-health`

### Health

`GET /health`

The service explicitly reports `livePayments: false` until the regulated settlement path is configured, authorised and end-to-end verified.

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

`GET /v1/payment-intents/:reference` returns payment state.

Test-only confirmation:

`POST /v1/payment-intents/:reference/sandbox-confirm`

This creates a sandbox transaction and ledger entries. It does not move real money.

### Merchant console

`GET /v1/merchant/summary`

Returns merchant profile, transaction metrics, recent transactions and payment links for the authenticated merchant.

### Payment links

`POST /v1/payment-links` creates a test-mode link.

`GET /v1/payment-links/:slug` returns a public non-secret representation.

### Merchant onboarding

`POST /v1/merchant-applications` accepts an initial business application. It deliberately does not collect identity documents or bank credentials through the public endpoint.

### KYB

The database now supports a controlled KYB lifecycle through `izp_kyb_profiles`, including business type, registration/tax references, representative information, risk level, review status and review notes. Live processing cannot be activated merely by submitting KYB.

### Pricing

The database now contains a merchant fee-plan engine. The initial IZAKHONO Standard test plan is **2.90% + R1.00** in ZAR. Fees are represented separately from gross and net transaction values so the ledger can reconcile them independently. Commercial pricing can be changed per merchant without changing the payment API contract.

### Routing

`izp_provider_accounts` registers candidate rails and capabilities. `izp_routing_rules` provides the control plane for selecting a rail by country, currency, payment method, amount and priority. Actual live routing remains disabled until the relevant provider credentials, contracts and regulatory/acquiring controls are verified.

### Refunds, disputes and settlements

The commercial core now includes dedicated records for:

- refunds and idempotent refund requests
- payment disputes/chargebacks and evidence metadata
- settlement batches and external settlement references
- audit events for merchant-facing actions

These records are designed so IZAKHONO can reconcile provider truth against its own ledger rather than treating an API response as proof of settlement.

### Webhooks

`POST /v1/webhook-endpoints` registers a merchant webhook URL and generates a signing secret. The raw secret is returned once; only its hash is retained.

The production delivery layer must sign event bodies, verify delivery state and implement retry/dead-letter handling before live launch.

## Data and safety boundary

IZAKHONO PAY owns the merchant-facing technology, API contract, routing layer, ledger, reconciliation, webhook orchestration and merchant experience. Phase 1 does **not** make IZAKHONO the custodian of merchant/customer funds. Live processing remains disabled until merchant KYB, applicable South African regulatory requirements, acquiring/settlement arrangements, provider credentials, production security controls and end-to-end verification are complete.

The platform must never claim a payment is live or settled merely because an API route exists. A live transaction must be confirmed by the configured regulated payment rail and reconciled into the IZAKHONO ledger.

## Commercial model

`Merchant → IZAKHONO PAY → regulated payment rail → merchant settlement`

IZAKHONO can earn a transparent platform/orchestration fee and/or negotiated processing margin where contractually and legally permitted. Marketplace splits, subscriptions, invoices, refunds, disputes, settlement reporting, fraud controls and cross-border capabilities belong behind the same merchant-facing API.

## Production roadmap

1. Complete merchant roles and secure dashboard authentication
2. Complete KYB review/approval workflow
3. Implement provider adapter interface and verified iKhokha/PayFast/Paystack connectors
4. Implement signed webhook delivery, retries and event verification
5. Complete refunds, disputes and reconciliation jobs
6. Activate smart-routing engine in controlled test mode
7. Complete marketplace split and settlement reporting
8. Remove embedded demo credentials and implement merchant API-key management
9. Add rate limiting, fraud/risk controls and observability
10. Complete regulatory/acquiring/settlement readiness for third-party live merchants
11. Deploy production frontend and custom merchant-facing domain

## Deployment status

The Supabase backend is the active development API. The Vercel `izakhono-pay` project is linked to the repository, but the latest public deployment remains subject to the account's daily deployment quota. No public production deployment is claimed until verified.

## Test credentials

The repository demo uses a test-only API key embedded in the demonstration frontend. It must be removed from any public production build and replaced by authenticated merchant credentials before external merchants are enabled.
