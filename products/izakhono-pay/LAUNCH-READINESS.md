# IZAKHONO PAY™ — Launch Readiness

**Status:** Controlled commercial pilot architecture

**Production runtime:** Prepared for a fail-closed deployment; deployment evidence is still required.

**Live money movement:** OFF

**Launch gate:** NO-GO until all required external evidence is verified.

## Verified platform capabilities

- Merchant payment orchestration and provider-adapter architecture
- iKhokha payment-link creation and signed webhook verification path
- Provider-side payment-status confirmation and amount matching before paid state
- Idempotent transaction creation
- Transaction state management
- Reconciliation lifecycle
- Refund lifecycle
- Dispute lifecycle
- Settlement lifecycle
- Operational alerting and reconciliation exceptions
- Merchant plans and fee model
- Merchant API credentials with service-role protection
- Benefits/rewards evaluation engine
- FORTRESS security controls and audit-oriented architecture
- Controlled acceptance suite: 6/6 passed

## Production deployment boundary

The production workflow deploys the Worker in a **fail-closed state**. It does not activate a payment provider, create a D1 database, activate a merchant, or move customer money.

Before running it:

1. The dedicated Cloudflare D1 database named izakhono-pay must already exist in the selected Cloudflare account.
2. The GitHub environment izakhono-pay-production must contain CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and IZAKHONO_PAY_ADMIN_SECRET.
3. The deployment preflight resolves the existing D1 UUID by exact database name and generates an ignored, temporary Wrangler config. It fails closed if the database is absent, ambiguous, or conflicts with a pinned ID; it never creates or deletes infrastructure.
4. The deployment verifies the health endpoint, confirms iKhokha/PayStack/PayFast are all disabled, and confirms no merchant is active.
5. The workflow returns a workers.dev URL. Custom-domain routing is a separate, verified cutover and is not changed by this workflow.

The production workflow does not require or install payment-provider credentials. Those credentials remain outside the deployment path until the separate provider-activation gate is approved.

## Current launch blockers

### 1. Regulatory / acquiring approval

Required regulated acquiring, payment, settlement and related arrangements must be verified before live processing is enabled. IZAKHONO PAY remains a non-custodial orchestration layer; regulated partners handle acquiring, custody and settlement until the operating model is appropriately authorised.

### 2. Production infrastructure evidence

The dedicated izakhono-pay D1 database and production GitHub environment secrets must be verified by a successful fail-closed deployment. A configured Vercel project or a successful preview build is not evidence that the Cloudflare Worker and D1 database are live.

### 3. South African provider activation

iKhokha is the preferred initial South African provider. Live activation requires approved merchant/provider credentials in the production secret store, confirmed callback registration, provider-generated signed webhook tests, a controlled end-to-end transaction, payout-bank verification and reconciliation. Provider routing remains disabled until all evidence is approved.

### 4. International provider scope

The current Worker checkout path is ZAR-only. Stripe/international processing is not part of the verified V1 Worker release and must not be advertised as available until a production adapter, webhook verification, currency handling and end-to-end acceptance have been implemented.

### 5. External production E2E

A real-provider production end-to-end payment has not been executed. This remains intentionally blocked until the regulatory/acquiring and provider activation prerequisites are satisfied.

## Activation sequence

1. Verify the existing production D1 database and GitHub environment secrets.
2. Deploy the fail-closed production Worker and apply migrations.
3. Verify the health endpoint, disabled provider capabilities and zero active merchants.
4. Verify custom-domain routing separately without interrupting any existing service.
5. Verify the regulatory/acquiring arrangement and evidence.
6. Provision iKhokha credentials only in the approved production secret store.
7. Register and test signed provider webhooks and provider-side status/amount matching.
8. Complete the approved controlled production E2E transaction and reconcile it to provider and bank records.
9. Submit and verify evidence for each launch-gate control.
10. Re-evaluate the launch gate and enable only the approved provider/merchant capability.
11. Monitor transactions, reconciliation, alerts and settlement from the first controlled live transaction.

## Non-negotiable controls

- Never bypass the launch gate.
- Never expose service-role credentials.
- Never treat a successful internal acceptance test as regulatory authorization.
- Never represent the controlled simulator as real-money processing.
- Never mark a provider live without verified activation evidence.
- Never enable an international currency route until its provider adapter and acceptance evidence are complete.
- Preserve provider independence so regulated/acquiring partners remain replaceable adapters.

## Product direction

IZAKHONO PAY is designed as the global payment orchestration layer for merchants, platforms and IZAKHONO products. The long-term architecture is:

**IZAKHONO PAY → Global Payment Orchestrator → Global Payment Network**

The customer-facing payment experience remains independent of the underlying payment rail wherever commercially and legally possible.
