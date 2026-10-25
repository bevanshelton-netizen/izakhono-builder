# IZAKHONO PAY — Production Readiness Gates

## Current state

IZAKHONO PAY is a controlled-pilot payment orchestration layer. The control plane, transaction ledger, provider-event ledger, benefits engine, merchant monetisation foundation, refund records, dispute records and settlement-reconciliation records are implemented in the connected Supabase project.

No live money movement is claimed by this document.

## Provider boundary

IZAKHONO PAY owns checkout/orchestration, merchant logic, transaction state, benefits and reporting. An authorised payment provider remains responsible for regulated payment processing, acquiring, clearing, settlement and custody until IZAKHONO obtains all authorisations required for any expanded role.

## Webhook security gate

The provider webhook endpoint is now fail-closed and verifies Stripe-style signed webhooks using:

- `Stripe-Signature` header
- timestamp freshness window
- HMAC-SHA256 verification against `STRIPE_WEBHOOK_SECRET`
- constant-time signature comparison
- provider-event idempotency

The endpoint returns `503 webhook_secret_not_configured` until the production secret is provisioned. This is intentional: no unsigned provider event is accepted.

## Refund and reconciliation gates

The orchestration API now supports controlled-pilot actions for:

- refund request creation with idempotency
- reconciliation summary reporting

The database includes service-role-only records for refunds, disputes and settlement entries. These records are designed so provider operations can be reconciled without turning IZAKHONO PAY into an unauthorised custodian of funds.

## Remaining production gates

1. Authorise and configure the actual provider account.
2. Provision `STRIPE_WEBHOOK_SECRET` securely in the production runtime.
3. Complete provider-specific payment creation/confirmation adapter against the authorised account.
4. Complete signed webhook end-to-end tests with provider-generated events.
5. Implement provider refund execution and map provider refund events back to the ledger.
6. Implement provider dispute/evidence workflow where applicable.
7. Reconcile provider payouts against transaction, fee, refund and dispute records.
8. Complete merchant dashboard and operational reporting.
9. Complete security review, compliance review and production acceptance testing.
10. Only then enable real-money processing for approved merchants and products.

## Non-negotiable rule

A successful database transaction or test provider event is not evidence that IZAKHONO PAY is live. Production status must be verified from the provider, deployment, webhook, settlement and reconciliation layers independently.
