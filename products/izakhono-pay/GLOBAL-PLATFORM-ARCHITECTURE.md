# IZAKHONO PAY — Global Platform Architecture and Market Expansion

**Canonical product:** IZAKHONO PAY  
**North star:** A globally accessible, merchant-first payment orchestration platform with country-aware authorised payment rails.  
**December 2026 objective:** Release a credible, secure controlled-market product and establish the international expansion foundation.  
**Release principle:** Global internet access is not the same as authorisation to process money in every jurisdiction.

## Product promise

A merchant should be able to integrate once with IZAKHONO PAY and, where the merchant and transaction are eligible, offer customers a familiar local payment experience. IZAKHONO PAY owns the merchant experience, payment intent lifecycle, routing policy, event and ledger records, reconciliation controls, developer interfaces and operational visibility. Regulated partners provide regulated acquiring, custody and settlement until a separately approved operating model permits anything else.

The platform must not imply that every country, currency, payment method or merchant category is currently supported. Availability is explicit, machine-readable and evidence-backed.

## Global product requirements

### 1. Worldwide access and experience
- Public product, documentation, hosted onboarding and demo surfaces must be reachable over the public internet with HTTPS, accessible responsive design and clear status messaging.
- APIs and hosted checkout must be versioned, documented, rate-limited and protected against abuse.
- Internationalisation foundation: locale-aware dates, number formats, language resources, time zones, right-to-left readiness and accessible interfaces.
- Checkout must display the merchant's configured legal identity, transaction amount, currency, payment method and support/refund information clearly.
- Edge caching may accelerate static assets only; never cache authenticated merchant data, payment state, session responses or sensitive API responses.
- Provide status/incident communications and a documented support path.

### 2. Country and currency capability registry
Build a governed capability registry. Every supported combination is a record, not an assumption:
- merchant incorporation/operating country;
- customer country and transaction corridor;
- presentment and settlement currencies;
- payment method and provider;
- merchant/provider eligibility and onboarding state;
- permitted business categories and transaction types;
- regulatory classification and evidence references;
- limits, settlement timing, refund/dispute support;
- environment (sandbox/production), effective dates and kill switch.

Unknown or unsupported combinations must fail closed with a useful reason. Do not fall back to a different country or currency silently.

### 3. Payment routing and provider resilience
- Use a provider-neutral contract with country/currency/method capability declarations, authentication/signature verification, idempotency, status enquiry, refund, dispute and settlement capabilities.
- Route only among explicitly enabled and eligible provider rails.
- Evaluate provider health, success rate, cost, latency and risk only within the approved eligible set; never route around legal or merchant restrictions.
- Support controlled failover, circuit breakers, provider-specific rate limits, timeouts and bounded retries.
- Use durable event claims and idempotent state transitions across concurrent instances.
- Keep provider credentials isolated per environment and merchant/tenant where required; never expose secrets to browser code.
- Do not build a new parallel payment core; extend the existing IZAKHONO PAY provider contract and authoritative runtime after source-of-truth parity is proven.

### 4. Global trust, risk and privacy
- Enforce tenant isolation at every API, query, webhook, dashboard, export and support workflow.
- Strong merchant/admin authentication, MFA for privileged roles, scoped credentials, rotation, session controls and owner-only platform administration.
- Risk controls include velocity limits, anomaly signals, provider fraud tools, dispute/chargeback handling and sanctions/PEP screening where legally required.
- Data minimisation, purpose limitation, retention/deletion controls, encryption in transit/at rest, audit trails and jurisdiction-aware data residency.
- Do not store raw PAN/CVV or banking credentials; use provider-hosted/tokenised payment capture and complete the applicable PCI responsibility assessment.
- SHELTON FORTRESS is an additional security/observability layer, not a substitute for provider, PCI, regulatory or independent security obligations.

### 5. Financial integrity and merchant operations
- Immutable source events and balanced ledger invariants for authorisations, captures, reversals, refunds, fees, disputes and settlements.
- Reconcile provider reports to IZAKHONO ledger and settlement/bank evidence; expose unmatched items and ageing.
- Idempotent refund requests, approval controls, refund status polling and exception queues.
- Merchant dashboard, role-scoped access, exports, notifications, webhook delivery/retry history and audit evidence.
- Clear pricing, service limits, terms, privacy, refunds, disputes and support service levels.

### 6. Developer ecosystem
- Versioned REST API and OpenAPI contract, server SDKs, webhook signing/retry documentation, idempotency examples and sandbox fixtures.
- Ecommerce integrations only after their security and compatibility tests pass.
- Stable error model, correlation IDs, request tracing and deprecation policy.
- Developer portal with credential lifecycle, environment separation, integration health and test events.

## Current architecture facts requiring action

Repository inspection on 19 November 2026 confirms:
- The product README describes IZAKHONO PAY as non-custodial orchestration and partner-led regulated money movement.
- src/routing.ts can select by country, currency, method, merchant KYB and environment.
- The inspected src/index.js payment-intent path currently queries routes using country ZA and reports ZA; this is South Africa-specific, not global routing.
- The inspected src/index.ts is a separate sandbox-oriented implementation with only the sandbox provider registered. It is not interchangeable with src/index.js without parity work.
- Sandbox Wrangler config has no verified remote D1 database ID; production config contains an all-zero D1 placeholder and PAYMENT_MODE=disabled.
- The platform roadmap already treats African multi-country routing as a staged expansion and says provider rails are replaceable.

Therefore: public web access can be global, but global live payment capability is not implemented or evidenced. Do not advertise global live processing yet.

## Market sequence

### Stage 0 — Global access foundation (November–December 2026)
- Establish the canonical runtime entrypoint and eliminate untested divergence between index.ts and index.js.
- Produce the authoritative schema/migration, route, provider, secret, environment and deployment map.
- Complete server-side payment evidence at the paid-order provisioning boundary.
- Complete sandbox provider lifecycle and webhook/replay/concurrency tests.
- Publish product, API docs, global capability statement, demo and merchant-interest/onboarding intake.
- Keep unsupported countries and all live money routes disabled.

### Stage 1 — South Africa controlled market (December 2026, gated)
- Confirm the exact provider-sponsored operating model and merchant approval.
- Obtain specialist South African legal/regulatory advice for the actual flows and external-merchant model.
- Provision and verify the authorised production D1 database; deploy only through owner-controlled workflow.
- Complete end-to-end payment, refund, settlement and reconciliation acceptance with authorised test/pilot merchant.
- Enable only the approved ZAR/provider/merchant capability tuple following written owner release decision.
- If live gates are not met, launch the global-facing product/demo and merchant intake in non-transactional mode; do not enable live payments.

### Stage 2 — First additional country
- Select the next country based on provider coverage, merchant demand, legal pathway, settlement reliability and support readiness.
- Complete local legal classification, provider/banking agreements, privacy/data-transfer review and financial-crime controls.
- Add explicit capability registry entries, provider adapter, currency rules, limits, refund/dispute and reconciliation tests.
- Pilot with a limited merchant cohort; expand only after reconciled evidence.

### Stage 3 — Multi-country expansion
- Add countries one at a time using repeatable country launch packs.
- Establish regional provider redundancy and approved data residency/processing architecture.
- Add local payment methods, local-language checkout and region-specific merchant operations.
- Do not announce a market as supported until its capability entry is enabled and the acceptance pack is approved.

## Competitive quality system

Better than all the others must be an engineering and customer-outcome programme, not an unprovable marketing claim. Track and publish only measured, comparable indicators:
- checkout completion and provider authorisation rates by eligible country/method;
- p50/p95 API and checkout latency;
- payment state correctness, duplicate suppression and webhook delivery latency;
- reconciliation match rate and unresolved financial exceptions;
- refund completion time and dispute response performance;
- platform availability, incident recovery time and recovery-point/recovery-time tests;
- onboarding time, integration time, support first-response/resolution time;
- security test coverage, vulnerability remediation time and independently assessed controls;
- transparent pricing and total merchant cost.

Set targets after baseline measurement and provider contractual constraints are known. Run regular competitor capability/price/experience reviews using public evidence; never claim superiority without comparable data.

## Mandatory launch controls
- No production payment activation through a UI flag alone.
- No provider credentials in source, browser assets, logs or ordinary deployment steps.
- No external merchant live activation without the required onboarding and legal/provider gates.
- No custody, stored value, direct acquiring, payout, remittance or marketplace split settlement without the applicable approved structure.
- Every release has a tested rollback, named accountable operator, monitoring and evidence pack.
- Administrative human access remains owner-only unless the owner explicitly approves named people; service accounts receive only scoped permissions.

## December deliverables
1. Canonical runtime and schema decision with route parity proof.
2. Global capability registry design and API contract.
3. Country/currency/method fail-closed routing tests.
4. Sandbox acceptance pack for success, decline, cancel, expiry, duplicate/concurrent webhook, refund and reconciliation.
5. Secure public product/docs/demo and merchant interest workflow.
6. South Africa legal/provider readiness pack and production infrastructure evidence.
7. Release dashboard showing each country and payment method as not_assessed, sandbox_only, approved_limited, live, or suspended.

## Current release statement

IZAKHONO PAY is being prepared as a globally accessible platform. At this point, the inspected runtime is South Africa-routed and sandbox/production entrypoints diverge. Production payment mode is disabled and the production D1 identity is unprovisioned. Global live processing is not available or authorised. The December objective is a credible controlled market entry and a verified first-market release path, followed by country-by-country expansion.