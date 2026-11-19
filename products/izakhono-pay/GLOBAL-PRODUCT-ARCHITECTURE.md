# IZAKHONO PAY — Global Product and Market Architecture

**Product:** IZAKHONO PAY  
**Positioning:** Global merchant payment operations and orchestration platform  
**First market:** South Africa  
**December 2026 objective:** Controlled market entry with an honest Alpha capability set; no unsupported claim of global payment acceptance.

## Product ambition

Make IZAKHONO PAY accessible to merchants, developers and customers over the public internet, with a consistent product experience and region-aware payment options. “Global” means a globally reachable platform and a deliberate path to country-by-country enablement. It does not mean every country, currency, provider or payment method is supported on day one.

## Competitive product standard

Compete on measurable outcomes rather than slogans:
- Availability, latency and checkout completion measured by region and provider.
- Payment success and decline recovery, separated by provider and issuer.
- Accurate, timely reconciliation and clear exception handling.
- Fast, well-documented integration with stable, versioned APIs and SDKs.
- Transparent pricing and predictable settlement visibility.
- Strong merchant ownership, tenant isolation, exportability and support.
- Fraud prevention and dispute operations with low false-positive rates.
- Accessible, responsive, multilingual-ready customer and merchant experiences.

Do not claim “best” or “better than every competitor” without a defined benchmark, independently reproducible results and current comparative evidence.

## Global platform layers

1. **Experience:** public product site, merchant console, customer checkout handoff, developer portal, status/incident page and support intake.
2. **Identity and tenancy:** merchant organisations, verified users, MFA, scoped roles, API credentials, service identities, tenant-aware audit logs and regional onboarding controls.
3. **Payments API:** versioned REST endpoints, idempotency, signed webhooks, request correlation, consistent error model, pagination, quotas and backwards compatibility.
4. **Orchestration:** payment-intent state machine, provider capability registry, routing/fallback rules, retry budgets, risk gates and provider health signals.
5. **Money and ledger:** ISO 4217 currency metadata and exponents, integer minor-unit arithmetic, immutable financial journal, fees/refunds/reversals, settlement batches and reconciliation.
6. **Provider connectivity:** independently certified adapters for cards, EFT/bank transfer, instant payments, wallets and local methods as commercially and legally approved in each country.
7. **Risk and trust:** merchant KYB, sanctions/fraud controls as required, velocity limits, webhook authenticity, replay defence, account takeover protection and case management.
8. **Global runtime:** CDN/WAF, regional stateless compute, durable regional data stores, encryption, backup/restore, observability, disaster recovery and controlled data residency.
9. **Operations:** merchant support, dispute/refund workflows, incident command, SLOs, on-call ownership and evidence-backed change/release management.

## Country and provider enablement model

Each country/payment rail requires a capability record containing:
- Country and merchant eligibility.
- Supported settlement and presentment currencies.
- Payment method and provider contract.
- Required licences/authorisations and legal opinion.
- KYB/KYC, sanctions, privacy and data-residency obligations.
- Provider sandbox and production credentials held in approved secret storage.
- Signature/status verification contract and failure semantics.
- Refund, dispute, settlement and reconciliation coverage.
- Tested limits, fees, cut-off times and settlement expectations.
- Signed provider, legal, security and product acceptance.

A provider is not selectable merely because its adapter exists. The routing engine must reject any provider/country/currency combination that lacks an enabled, verified capability record.

## Global security and reliability baseline

- Default-deny access, owner-only human administration unless explicitly approved, least-privilege service identities.
- MFA for privileged and merchant users; short-lived credentials where supported; key rotation and revocation.
- Strict tenant isolation and object-level authorization on every merchant resource.
- TLS in transit, encryption at rest, managed secrets and no secrets in browser bundles or logs.
- Signed webhook verification over exact raw request bytes where provider contract requires it.
- Durable idempotency and replay controls across instances; transactional outbox and retryable delivery.
- Rate limiting, abuse controls, WAF, vulnerability scanning, dependency governance and security response.
- Defined SLOs, region-specific synthetic monitoring, incident playbooks, RPO/RTO, tested restore and rollback.
- Independent penetration test and privacy/security review before broad commercial expansion.

## Delivery stages

### Stage 0 — December 2026 South Africa Alpha
- Publicly reachable product/demo and merchant onboarding.
- ZAR only; current provider integrations only after approval and exact sandbox/live contract verification.
- No live-money activation until all existing release gates are evidenced and the owner signs release approval.

### Stage 1 — Global foundation
- Canonical public API, portal, developer documentation and merchant identity.
- Multi-currency-safe data contracts, currency exponent metadata and tests.
- Provider capability registry and country eligibility engine.
- Region-aware privacy, data residency and operational design.
- Observability and SLO dashboards.

### Stage 2 — First additional market
- Select one additional country using merchant demand, provider readiness, regulatory complexity and settlement reliability.
- Obtain written provider and legal approval; complete sandbox certification, reconciliation and controlled pilot.
- Launch only the verified payment methods and currencies.

### Stage 3 — Multi-region scale
- Add providers and countries one controlled capability at a time.
- Deploy regional compute/data according to latency, resilience and legal requirements.
- Independently benchmark checkout latency, uptime, conversion, reconciliation accuracy, fraud loss and support performance.

## Current Alpha constraints that must remain visible

- Current checkout code rejects currencies other than ZAR. Do not remove that guard until end-to-end multi-currency correctness is implemented and tested.
- Current providers are not a global coverage map. Their real account permissions, supported currencies, regions, settlement and refund capabilities must be verified.
- Global accessibility requires a confirmed production domain, TLS, WAF/CDN, privacy and support pages, monitoring and an approved hosting deployment. Do not claim this is deployed until verified.
- Production D1 identity is not provisioned in the checked-in configuration; live mode remains disabled.
- South African legal/provider gates remain open; other countries need their own legal/provider review.

## December launch promise

The December release may introduce IZAKHONO PAY to the market as a globally oriented platform with a South Africa-first Alpha. Public access, demos and merchant onboarding can be prepared separately from live-money acceptance. Do not misrepresent future roadmap features as currently available.
