# IZAKHONO Growth Engine
## Native performance marketing and revenue optimisation capability

**Status:** Architecture and product specification  
**Owner:** IZAKHONO  
**Integration principle:** Owned-first, externally reversible  
**Source inspiration:** Publicly supplied Heir Digital service and operating-model description  
**Not an affiliation:** This specification does not assert a relationship with Heir Digital, Meta, Google, Shopify, or any named customer.

## 1. Purpose

IZAKHONO Growth Engine is a reusable, multi-tenant capability for delivering measurable customer acquisition and conversion improvement to IZAKHONO businesses and approved external clients.

It internalises a category of services demonstrated in the supplied reference material—paid media, creative production, analytics, conversion-rate optimisation, client servicing and growth strategy—without copying another agency's identity, website, claims, client data, testimonials, creative work or proprietary methods.

The product is an IZAKHONO capability, not a clone of an external agency.

## 2. Product boundary and architecture

Growth Engine is a product/service domain inside the existing IZAKHONO ecosystem. It must reuse existing canonical systems rather than create parallel identity, billing, CRM, audit, service-catalogue or deployment systems.

| Existing system | Growth Engine responsibility |
|---|---|
| IZAKHONO ROOT / I-NET | Discoverable capability, ecosystem routing and approved service entry points |
| ONE HUB | Unified customer and operator workspace; resolve services from the canonical registry rather than hard-coded duplicate catalogues |
| FORTRESS | Identity, tenant isolation, role/permission decisions, secret access, integration authorisation and audit |
| IZAKHONO BUILDER / WebStart | Build and manage campaign landing pages, microsites and approved conversion experiences |
| Business Automation / CRM | Leads, opportunities, client onboarding, tasks, approvals, communications and service lifecycle |
| I-PAY | Approved invoices, subscriptions and customer payments; reuse existing payment boundaries |
| Runtime Fabric / HOST | Operate approved workloads through authorised runtime interfaces |
| Existing analytics and data services | Reporting and measurement, subject to source permissions and data-governance rules |

No new source of truth is introduced for users, tenants, payments, invoices, audit records or registered services.

### Integration constraints

- Use the existing service/product registry as the canonical discovery source.
- Treat any ONE HUB hard-coded service list as a migration target, not a second registry.
- Integrate through versioned, authenticated service contracts and provider adapters.
- Keep provider credentials server-side and tenant-scoped; never expose them to browser clients.
- Do not add database migrations, change database ownership, or write production data until the authorised database owner and migration process are confirmed.
- Do not infer a production runtime, registered execution environment, provider approval or API entitlement from source code or CI.

## 3. Capability modules

### 3.1 Paid Media Operations

**Meta Ads**
- Campaign, ad-set and creative planning
- Facebook and Instagram campaign operations
- Audience and placement experiments within platform policy
- Budget pacing, delivery monitoring and optimisation recommendations
- Conversion and retargeting measurement where consent and platform rules permit

**Google Ads**
- Search, Shopping, Display, YouTube and Performance Max campaign operations
- Keyword/search-term analysis and negative-keyword recommendations
- Feed and product-catalogue diagnostics
- Budget pacing, conversion measurement and optimisation recommendations

Both channels are provider adapters, not hard dependencies. A tenant can use one, both, another approved provider, or neither. API access, scopes, account ownership, platform terms and customer authorisation must be verified before any live read or write.

### 3.2 Creative Studio

- Creative briefs and brand constraints
- Static, motion and video creative production workflows
- UGC commissioning and rights/consent tracking
- Variant generation and structured A/B test assignment
- Asset review, approval, versioning and usage-rights records
- Creative performance reporting

The platform records ownership, licences, releases and permitted usage. It does not scrape or reuse third-party creative assets.

### 3.3 Growth Intelligence

- Campaign and channel performance
- Spend, impressions, reach, clicks and conversion events
- Revenue, orders and qualified-lead outcomes where source integrations support them
- ROAS, CAC, CPA, conversion rate and customer cohort reporting
- Attribution model and data-source disclosure
- Budget pacing, anomaly detection and recommendations
- Experiment history and evidence-backed learning

Every metric must retain its source, currency, reporting window, attribution model, freshness and completeness status. Platform-reported conversions, analytics events and finance-confirmed revenue must remain distinguishable. Do not present estimates as verified revenue.

### 3.4 Conversion Optimisation (CRO)

- Landing-page and product-detail-page audits
- Funnel and checkout diagnostics
- Page performance and accessibility checks
- Experiment hypotheses, variants and acceptance criteria
- A/B and multivariate test management
- Statistical methodology and test stopping rules
- Before/after measurement with limitations disclosed

Experiments must not be declared winners from insufficient samples or arbitrary percentage lifts. Changes to a client's live site require client approval and a controlled release path.

### 3.5 Strategy and Consultancy

- Discovery and account audit
- Market and competitor research
- Growth strategy and channel selection
- Forecasts and budget scenarios with assumptions
- Campaign roadmap and creative testing plan
- Monthly/quarterly business reviews
- Scaling and risk recommendations

Forecasts are scenarios, not guarantees. No revenue, ROAS or growth outcome is promised without evidence and contractual terms.

### 3.6 Client Service and Account Operations

- Client onboarding and business verification
- Tenant, brand and ad-account mapping
- Goals, baselines, budgets and approval limits
- Service plans, statements of work and deliverables
- Tasks, owners, milestones and communication history
- Weekly/monthly reporting and review meetings
- Renewal, offboarding, access revocation and data export

Client workspaces and all connected data must be isolated by tenant and authorised role.

## 4. Core operating lifecycle

1. **Discover** — capture the client's business, goals, markets, products and constraints.
2. **Qualify** — assess fit, readiness, economics, permissions and delivery capacity.
3. **Audit** — review current accounts, tracking, creative, landing pages and baseline results.
4. **Propose** — issue a scoped strategy, deliverables, assumptions, fees and media-budget boundaries.
5. **Contract and onboard** — obtain required agreements, platform access, data permissions and client approvals.
6. **Plan** — create campaign structure, creative briefs, conversion events, budgets and experiment plans.
7. **Approve** — obtain explicit approval for campaign content, destination URLs, spend caps and launch.
8. **Launch** — execute only through verified provider adapters and approved account permissions.
9. **Measure** — ingest permitted source data, validate freshness and reconcile against business outcomes.
10. **Optimise** — recommend or execute changes within delegated limits; escalate material changes for approval.
11. **Report** — provide transparent results, attribution caveats, spend and next actions.
12. **Renew or close** — renew scope or revoke access, export customer data and apply retention rules.

## 5. Commercial model

Growth Engine supports configurable commercial offers, subject to IZAKHONO approval:

- Paid media management retainer
- Fixed-scope audit or strategy engagement
- Creative production packages
- CRO audit and optimisation projects
- Managed growth programmes
- Enterprise or multi-brand engagements

Media spend is separate from IZAKHONO service fees unless a separately approved contract explicitly states otherwise. The client remains the owner/approver of ad-account spend and payment instruments by default. No pricing, tariff, customer count, revenue result or case study is asserted by this architecture document.

Quotes, contracts, invoices, subscriptions and payment status must use the existing IZAKHONO commercial and I-PAY boundaries. Do not create a parallel wallet or payment ledger.

## 6. Domain records (logical model)

These are conceptual records for contract and schema design, not authorisation to create or migrate production tables.

- **GrowthTenant** — customer organisation and tenant boundary.
- **Brand** — brand identity, markets, domains and brand constraints.
- **ServiceEngagement** — approved scope, commercial terms, lifecycle and service owner.
- **ChannelConnection** — provider, external account reference, granted scopes, owner, status and expiry metadata; no plaintext secrets.
- **Campaign** — channel, objective, budget ceiling, schedule, status and approval references.
- **CreativeAsset** — source, version, rights, consent, approval and destination campaign.
- **ConversionEvent** — event definition, source, consent basis and deduplication key.
- **MetricObservation** — metric, value, currency/unit, source, window, attribution model and freshness.
- **Experiment** — hypothesis, variants, assignment, sample criteria, status and result.
- **Approval** — actor, scope, decision, timestamp, expiry and evidence reference.
- **Report** — period, source snapshots, metric definitions, caveats and recipients.
- **AuditEvent** — reference to the canonical FORTRESS audit record.

Every customer-owned record is tenant-scoped. Provider identifiers are not treated as tenant identity. Enforce access at the API and persistence layers; UI filtering alone is not security.

## 7. Security, privacy and financial controls

- FORTRESS remains authoritative for identity, authorisation, secrets access and audit.
- Enforce tenant isolation, least privilege, role separation and explicit client consent.
- Provider OAuth grants must be scoped, revocable, attributable and stored server-side.
- Never request or store a client's platform password.
- Separate read, draft, approve, publish and budget-management permissions.
- Require explicit approval for first launch, material creative changes, destination changes and budget increases.
- Enforce per-campaign and per-account spend ceilings where supported; fail closed when approval or spend state is unknown.
- Log actor, tenant, account, action, before/after state, timestamp, idempotency key and provider response reference.
- Validate webhook signatures, replay protection, idempotency and event provenance.
- Minimise personal data; honour consent, applicable South African privacy requirements including POPIA where applicable, platform policies, retention schedules and deletion/export requests.
- Do not build sensitive-trait audiences or infer protected characteristics.
- Keep customer data out of model training and unrelated tenants unless a separately approved lawful basis and contract permits it.
- Use financial-source reconciliation for revenue claims; never treat ad-platform attribution as a ledger.

## 8. Provider adapter contract

Each external channel integration must implement a provider-neutral contract with:

- connection discovery and health
- least-privilege capability declaration
- read-only account/campaign retrieval
- draft creation and validation
- explicit approval check before mutations
- idempotent campaign/creative/budget mutation
- spend and delivery reporting
- webhook verification and replay defence
- rate-limit handling, retry policy and circuit breaking
- token revocation and connection removal
- audit correlation and evidence export

A provider adapter being implemented does not mean it is connected, certified, approved or live. Sandbox/test evidence and production evidence must be labelled separately.

## 9. Service catalogue and public claims

Growth Engine may be registered as a capability in the existing canonical service catalogue with an explicit readiness state. Initial catalogue metadata must identify it as **DESIGN_SPECIFIED / NOT_LIVE** until each feature passes its own evidence gates.

Public pages must not claim:
- a number of clients or brands served;
- advertising spend managed or revenue generated;
- platform certification, partner status or privileged access;
- named customer relationships, testimonials or case studies;
- guaranteed results or specific ROI improvements;

unless each claim is independently evidenced, authorised for publication and current.

## 10. Delivery and acceptance phases

### Phase A — Architecture and product definition
- Approve this capability boundary and service taxonomy.
- Map existing registry, CRM, reporting, Builder and I-PAY contracts.
- Confirm service ownership, privacy responsibilities and commercial approval.

### Phase B — Read-only foundation
- Add a canonical registry entry using the existing registry contract.
- Build tenant-scoped client, brand, engagement and reporting read models using existing approved persistence.
- Add provider connection metadata and health checks without storing live credentials.
- Validate API contracts, RBAC, RLS, audit and tenant isolation.

### Phase C — Controlled workflow
- Add campaign briefs, creative approvals, experiment plans and reporting workflows.
- Add test/sandbox provider adapters.
- Prove idempotency, replay handling, rate limits, revocation and failure recovery.

### Phase D — Approved live integrations
- Obtain client-authorised Meta/Google access and verify account ownership/scopes.
- Complete security, privacy, provider-policy and end-to-end testing.
- Enable read-only production data before any write capability.
- Require explicit per-tenant/per-account approval for campaign mutations and spend.

### Phase E — Managed commercial service
- Connect approved engagement, invoicing and payment flows through existing systems.
- Establish service-level reporting, operational ownership, support and incident handling.
- Publish only independently verified case studies and performance claims.

## 11. Release gates and non-goals

This document is a design specification only. It does not:
- deploy code or workloads;
- create database tables or apply migrations;
- connect Meta, Google, Shopify or client accounts;
- create or publish advertisements;
- spend or transfer customer funds;
- alter DNS, domains, production routes or hosting;
- assert commercial partnerships, platform certifications or client relationships.

Implementation must proceed through reviewable changes, tests and explicit acceptance. Production execution remains subject to verified authorised HOST/runtime access, registered execution capability, database ownership and migration authority, FORTRESS authorisation, privacy/security review and end-to-end acceptance.

## 12. Success criteria

Growth Engine is considered operational only when:
- it is discoverable from the canonical IZAKHONO registry and ONE HUB;
- tenant isolation and permission tests pass at API and persistence layers;
- every provider connection is attributable, revocable and least-privileged;
- campaign writes and spend changes are approval-gated and auditable;
- reporting preserves metric provenance and attribution limitations;
- CRO experiments use documented statistical criteria;
- client onboarding, delivery, reporting, billing and offboarding work end-to-end;
- deployment and production status are supported by independent runtime evidence.

**IZAKHONO Growth Engine — acquire responsibly, convert intelligently, measure honestly, and scale with control.**


## 13. Repository integration progress — 23 November 2026

The first read-only registration slice is included in the Growth Engine integration branch:
- canonical capability contract: `products/izakhono-super-app/growth-engine.v1.json`;
- SUPER APP module registry entry, marked `architecture-ready`;
- IZAKHONO ONE service registry entry, marked `gated` with no public URL;
- read-only `GET /api/growth-engine/status` descriptor and module discovery entry;
- tests and contract validation for the non-live state.

The SUPER APP now includes a local `/growth-engine` planning view. It creates a deterministic workflow preview only. Meta/Google connections, campaign execution, publishing, spend, customer-data persistence, and production activation remain disabled. This registration is not evidence of provider access or live service availability.


## 14. Verified CRM, FLOW and ADS handoff boundaries

Repository source inspection confirms the existing integration contracts:
- CRM's FLOW adapter accepts `POST /api/flow`, requires `X-Entity-ID` and `X-Platform-ID`, authenticates the integration caller with `CRM_INGEST_TOKEN`, and deduplicates replayed action IDs.
- FLOW accepts scoped `POST /api/events` using `FLOW_INGEST_TOKEN`, records the event and creates a durable action outbox. A `lead.created` event routes a `crm.intake.requested` action to its CRM adapter when a real adapter is configured.
- FLOW rejects payment confirmation unless the source is `izakhono-pay`, verification status is `verified`, and a payment reference is present.
- IZAKHONO ADS requires a valid `izakhono.marketing.package.v1` sourced from IZAKHONO CREATE before campaign creative/distribution workflow; external ad accounts remain disconnected in its current alpha.

The Growth Engine contract now records these exact handoff requirements. No internal endpoint, bearer token, staff credential, ad account or client data is configured or transmitted by this change. CRM/FLOW/ADS runtime activation remains independently gated.
