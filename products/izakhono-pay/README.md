# IZAKHONO PAY

**Global merchant payment operations platform — South Africa-first release**

IZAKHONO PAY is being engineered as an internet-accessible, multi-region merchant payment orchestration and operations platform. South Africa is the first controlled market; it is not the geographic ceiling.

IZAKHONO PAY owns the merchant experience, payment-intent lifecycle, idempotency, event model, ledger metadata, routing policy, risk controls and reconciliation control plane. Authorised regulated providers handle regulated money movement until IZAKHONO is appropriately authorised.

## Product capabilities

- Internet-accessible merchant portal and versioned APIs
- Merchant onboarding, organisations, roles and audit trails
- Payment intents, payment links and hosted-checkout handoff
- Provider-neutral adapters and deterministic routing
- Idempotency, signed webhook ingestion and durable event processing
- Transaction history, receipts, refund requests and dispute workflows
- Ledger records, settlement visibility and reconciliation
- Sandbox and production environment isolation
- Multi-currency data model and regional provider capability registry (progressively enabled only after provider validation)
- Developer documentation, API keys, webhook configuration and integration examples

## Global architecture principles

1. **Global access, regional compliance:** internet availability does not mean every provider, currency or payment method is available in every country. Enforce country, merchant, currency and provider eligibility at runtime.
2. **One canonical payment core:** providers are replaceable adapters; the IZAKHONO ledger/event store is the internal system of record for orchestration evidence, not a substitute for provider settlement records.
3. **Money correctness:** store amounts in integer minor units with explicit ISO currency, currency exponent and provider-specific amount conversion. Never assume every currency has two decimal places.
4. **Tenant isolation:** every merchant-owned object is scoped server-side to an authenticated tenant; never trust a client-supplied merchant ID as authorization.
5. **Durable workflows:** idempotent commands, transactional event claims, replay protection, outbox/retry semantics and recoverable state transitions.
6. **Security by default:** owner-controlled administration, least privilege, server-side secrets, strong authentication, auditable key rotation, rate limits, fraud controls and redacted telemetry.
7. **Resilient internet service:** versioned APIs, health/readiness checks, regional deployment strategy, backups, restore tests, incident response and tested rollback.
8. **Portable infrastructure:** documented data export, infrastructure-as-code and deployability without dependence on one hosting vendor.

## Current launch scope (Alpha)

- South African rand (ZAR) checkout only.
- iKhokha, Paystack and PayFast adapters subject to each provider's merchant approval, account configuration and supported flow.
- Merchant/payment orchestration; providers handle regulated payment processing and settlement.
- Sandbox/demo first; live processing stays disabled until signed release gates pass.

Currency-safe groundwork now includes explicit exponent metadata and exact integer minor-unit conversion for ZAR, USD, EUR, GBP, AUD, CAD, NZD, CHF, JPY, KRW, BHD, KWD, JOD, OMR, TND, CLP, XAF, XOF, NGN, KES, GHS, EGP, INR, CNY, SGD, HKD, AED, SAR, BRL and MXN. This is a money-arithmetic foundation, not a statement that those currencies are enabled for checkout. The current provider router and checkout remain ZAR-only. Do not describe Alpha as global multi-currency processing. Each market and payment rail must be explicitly certified, contracted, tested and enabled.

## Payment flow

Merchant → IZAKHONO PAY API → Payment Intent → Eligibility & Risk Controls → Provider Adapter → Hosted Checkout → Verified Webhook → Durable Event Store → Ledger/Reconciliation → Merchant Portal/API

## Non-negotiable controls

- Never store card PAN/CVV or online-banking credentials.
- Require idempotency for money-moving commands.
- Verify provider webhooks and independently confirm provider payment status before fulfilment.
- Bind payment evidence to merchant, customer, order, amount, currency, reference and provider transaction.
- Fail closed on unknown provider, unsupported currency, mismatched identity or uncertain payment state.
- Separate sandbox from production accounts, databases, secrets, domains and deployment approvals.
