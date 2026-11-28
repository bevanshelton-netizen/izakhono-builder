# IZAKHONO COMMERCE PLATFORM ARCHITECTURE V1

**Status:** Draft architecture proposal  
**Owner:** IZAKHONO  
**Scope:** First-party commerce domain architecture and phased delivery plan  
**Principle:** WE DON'T BUY. WE BUILD. WE INTEGRATE. WE AUTOMATE. WE OWN.

## 1. Executive intent

IZAKHONO COMMERCE is the first-party commercial transaction and digital-trading capability for the IZAKHONO ecosystem. It supports business-to-business (B2B), business-to-consumer (B2C), wholesale, manufacturer-to-distributor, assisted sales, subscriptions and governed multi-vendor marketplace models.

The platform must support the full commercial journey:

`DISCOVER → PRICE → QUOTE → APPROVE → ORDER → PAY → FULFIL → DELIVER → RETURN/RESOLVE → RECONCILE → ANALYSE`

It is not merely a storefront. It is a reusable commerce domain that coordinates buyers, sellers, catalogues, commercial agreements, orders, payments, fulfilment and after-sales processes.

The objective is to build an IZAKHONO-owned software platform that can be deployed in authorised execution environments, integrate with existing enterprise systems and avoid unnecessary dedicated hardware or compulsory proprietary commerce infrastructure.

This document is an architecture proposal. It does not claim that the described platform is implemented, deployed, production-ready, legally certified or commercially available.

## 2. Repository and ecosystem reconciliation

The design deliberately builds on existing IZAKHONO capabilities rather than creating parallel control planes:

| Existing capability | Verified position / relationship | Commerce boundary |
|---|---|---|
| IZAKHONO ONE | Existing SUPER APP; its commerce pillar is registered with catalogue, orders and payments capabilities and remains foundation / prepare-only | User access and service discovery; not a second commerce transaction engine |
| IZAKHONO Integration Fabric (PR #766) | Open draft architecture proposal for connectors, API mediation, messaging, transformation, workflows and governance | Reusable integration plane; Commerce owns its commercial domain records |
| I-PAY | Existing payment product and merchant/payment workstreams | Payment orchestration and verified payment evidence; Commerce stores references and transaction state, not card credentials or a parallel payment ledger |
| IZAKHONO FLOW | Existing workflow orchestration capability | Cross-product process orchestration; Commerce exposes domain commands/events and does not create a competing workflow engine |
| IZAKHONO ENTERPRISE / Manufacturing | Enterprise and industrial capabilities are being architected across the ecosystem | ERP remains authoritative for finance, procurement, stock valuation and manufacturing records according to explicit domain ownership |
| CRM / Business Studio / Growth Engine | Existing customer and business lifecycle capabilities | CRM remains authoritative for customer relationships, leads, opportunities and sales activities |
| Builder Economy / Marketplace work (PRs #341–342) | Existing app-builder developer economy and marketplace foundations | Reuse only proven generic listing, entitlement, metering and commercial primitives; do not assume this is already a general product marketplace |
| LegacyMart | Existing marketplace/storefront work from earlier initiatives | Treat as a candidate reference tenant/storefront and migration/integration case, not as proof that the general Commerce platform is complete |
| FORTRESS / IZAKHONO ID | Shared identity, policy and security authorities | Remain authoritative for identity, authentication, permissions, secrets and security audit |
| NODE01 / Runtime Fabric / HOST | Shared software orchestration and separately authorised execution architecture | NODE01 is a logical software identity, never a physical machine; execution environments are replaceable and independently authorised |

No existing product should be absorbed in a way that destroys its independent system-of-record responsibilities. Integration must use versioned contracts and explicit ownership.

## 3. Product scope and capability domains

### 3.1 Commerce channels

- B2B buyer portals and wholesale ordering.
- B2C storefronts and direct-to-consumer checkout.
- Manufacturer and distributor portals.
- Dealer, reseller and franchise channels.
- Sales-representative assisted commerce.
- Multi-vendor marketplaces and B2B2C models.
- Subscription and recurring-order commerce.
- Headless commerce APIs for external websites, apps and partner channels.

Channels are presentation and interaction surfaces. They must use shared, governed domain services rather than maintain separate order or pricing logic.

### 3.2 Core domain capabilities

1. **Organisation and account management:** buyer organisations, legal entities, branches, departments, buying groups, delivery locations, account hierarchies and delegated users.
2. **Seller and vendor management:** seller onboarding, verification status, contracts, catalogues, territories, service levels, commissions and suspension.
3. **Product and service catalogue:** product identifiers, variants, attributes, units of measure, media, specifications, bundles, service items, availability and publication lifecycle.
4. **Commercial agreements:** customer-specific catalogues, negotiated price books, contract terms, volume breaks, discounts, currency, tax treatment and effective dates.
5. **Discovery and merchandising:** search, filters, categories, recommendations, product comparison, promotions and channel-specific presentation.
6. **Cart and checkout:** saved carts, bulk import, large order lists, delivery selection, tax calculation, validation and checkout preparation.
7. **Quotes and negotiation:** request-for-quote (RFQ), quote versions, validity, negotiated terms, approval, acceptance and conversion to an order.
8. **Purchasing authority:** spending limits, cost centres, approval chains, separation of duties, purchase-order references and delegated authority.
9. **Order management:** order creation, immutable commercial snapshots, status transitions, partial fulfilment, cancellation, amendments and backorders.
10. **Inventory availability:** stock visibility, reservations, allocation and availability promises through the authoritative inventory/ERP integration.
11. **Payment coordination:** payment intent, authorised payment methods, payment status, refunds and settlement references through I-PAY and approved payment providers.
12. **Fulfilment and delivery:** warehouse allocation, picking, packing, dispatch, shipment tracking, proof of delivery and split shipments.
13. **Returns and after-sales:** return merchandise authorisation, exchanges, refunds, warranty/service cases and dispute evidence.
14. **Marketplace operations:** seller listings, moderation, commissions, order splitting, vendor fulfilment, seller statements and controlled settlement.
15. **Commerce analytics:** conversion, order value, repeat purchase, margin signals, seller performance, demand and operational exceptions.

## 4. B2B-specific operating model

B2B is not a consumer cart with larger quantities. It must model real organisational purchasing relationships.

A buyer organisation can contain multiple legal entities, branches, departments, cost centres, delivery sites and users. Each user receives scoped permissions through IZAKHONO ID and FORTRESS.

Required B2B features include:

- organisation registration and verification workflows;
- head-office and branch hierarchies;
- buyer, requester, approver, procurement manager and finance roles;
- customer-specific product visibility and price books;
- negotiated contract pricing and volume tiers;
- minimum order quantities and pack-size rules;
- RFQs, quote revisions, validity periods and acceptance;
- requisition-to-purchase-order workflows;
- configurable approval thresholds and multi-step approvals;
- credit terms and account limits only when backed by the authoritative finance/credit system;
- saved order templates, bulk SKU upload and repeat ordering;
- partial orders, backorders and scheduled deliveries;
- consolidated statements and invoice references from the finance system.

Approval rules must be enforced server-side. A user must not approve their own transaction where separation-of-duties policy prohibits it. Approval decisions must capture actor, scope, policy version, timestamp, decision and correlation ID.

## 5. Commercial and pricing engine

Pricing is a governed domain service, not a client-side calculation.

The engine should support:

- list and base prices;
- customer and contract price books;
- seller-specific prices;
- quantity and volume tiers;
- time-bounded promotions;
- coupons and campaign rules;
- channel, territory and currency conditions;
- minimum advertised or resale-price constraints where contractually and legally applicable;
- tax-inclusive and tax-exclusive display;
- shipping, handling and surcharges;
- price rounding and currency precision rules.

Every accepted quote and order must retain an immutable pricing snapshot: item, quantity, unit price, discount, tax basis, currency, delivery charge, rule/version references and final totals. Later price changes must not silently rewrite accepted commercial terms.

AI may recommend a price or discount for an authorised human to review. It must not bypass contract floors, margin controls or approval limits.

## 6. Order lifecycle and transaction integrity

The order domain must define explicit, validated state transitions. A proposed lifecycle is:

`DRAFT → SUBMITTED → VALIDATING → APPROVAL_PENDING → ACCEPTED → PAYMENT_PENDING / CREDIT_APPROVED → ALLOCATING → PARTIALLY_FULFILLED / FULFILLED → DELIVERED → CLOSED`

Exceptional states include `REJECTED`, `CANCELLED`, `ON_HOLD`, `BACKORDERED`, `PAYMENT_FAILED`, `RETURN_REQUESTED` and `DISPUTED`.

Rules:

- State transitions are performed by authorised domain commands, never arbitrary client updates.
- Every command is tenant-scoped and idempotent.
- Duplicate submissions must not create duplicate orders, charges or fulfilment tasks.
- Order lines and accepted commercial terms are versioned/snapshotted.
- Partial fulfilment and split shipments are first-class states.
- Concurrent updates use optimistic version checks or equivalent concurrency controls.
- Irreversible or financially consequential transitions require the appropriate FORTRESS decision and, where configured, human approval.
- Events are emitted through the approved integration/event infrastructure with an outbox or equivalent durable publication pattern.
- Failed downstream delivery is retried safely and reconciled; it must not silently lose an accepted order.

## 7. Payment, finance and regulatory boundaries

Commerce coordinates the payment journey; it does not become an unlicensed bank, payment scheme, credit provider or custodian.

- I-PAY is the preferred IZAKHONO payment product boundary, subject to its verified runtime, provider and regulatory readiness.
- Approved payment service providers execute regulated payment processing where required.
- Commerce stores payment intent IDs, provider references, verified status, amount, currency, timestamps and reconciliation evidence.
- Card data and sensitive payment credentials must not be stored in the Commerce domain.
- Payment success is accepted only from authenticated, signature-verified provider evidence or an authoritative I-PAY result, never from a browser redirect alone.
- Webhooks require signature verification, replay protection, idempotency and durable audit.
- Refunds, reversals, chargebacks and settlement differences have explicit lifecycles.
- Credit accounts and credit limits are read from an authorised finance/credit system; Commerce must not invent or independently extend credit.
- Finance/ERP owns accounting journals, tax ledgers, receivables, payables and financial close. Commerce supplies reconciled commercial events and references.

South African deployments require activity-specific review of applicable laws and obligations, which may include POPIA, the Consumer Protection Act, the Electronic Communications and Transactions Act, VAT/tax rules and payment-sector requirements. Cross-border deployment requires jurisdiction-specific privacy, consumer, tax, sanctions and trade review. This architecture is not a legal compliance certification.

## 8. Marketplace model

Marketplace mode supports multiple sellers under a governed operator.

The platform must distinguish:

- marketplace operator;
- seller legal entity and seller users;
- buyer legal entity and purchasing users;
- seller-owned catalogue/listings;
- shared or seller-specific inventory;
- commission and fee schedules;
- order allocation and split-order rules;
- fulfilment responsibility;
- refund and dispute responsibility;
- seller statement and settlement evidence.

Seller onboarding, verification and payout eligibility are gated by required evidence and approved payment/settlement partners. A seller listing must not imply stock, delivery coverage, warranty or regulatory approval that has not been verified.

For multi-seller carts, the platform creates a buyer-facing parent checkout/order with explicit seller sub-orders only where the transaction, tax, fulfilment and payment model supports it. Each seller's responsibility and customer-facing commitments must be clear.

## 9. Architecture and authority boundaries

Logical service flow:

`STOREFRONTS / BUYER PORTALS / SALES WORKSPACE`
→ `COMMERCE API AND DOMAIN SERVICES`
→ `CATALOGUE · PRICING · QUOTES · CART · ORDERS · MARKETPLACE`
→ `VERSIONED DOMAIN EVENTS / INTEGRATION FABRIC`
→ `ERP · INVENTORY · MES · CRM · I-PAY · LOGISTICS · TAX / INVOICING`

Shared controls apply across the flow:

- **IZAKHONO ID:** principal and organisation identity.
- **FORTRESS:** authentication integration, authorisation, policy decisions, secrets access and security audit.
- **Integration Fabric:** connector lifecycle, API mediation, durable messaging, transformation, retry, dead-letter and reconciliation patterns. PR #766 is a separate open architecture proposal; its capabilities must not be treated as deployed.
- **FLOW:** cross-product workflow orchestration where a durable multi-service process is required.
- **Runtime Fabric:** workload state and scheduling according to its canonical contract.
- **NODE01:** logical software/orchestration identity, never a computer or server.
- **HOST / execution environment:** separately identified, authorised and replaceable execution substrate.
- **I-PAY:** payment execution/coordination boundary.
- **ERP / Finance:** accounting and financial system of record.
- **CRM:** customer relationship, lead, opportunity and sales activity system of record.

Commerce owns its own catalogue/listing, quote, cart, order and marketplace-domain records only where the canonical domain ownership register assigns them to Commerce. Shared customer, identity, finance, payment, inventory and workflow records must not be duplicated as competing sources of truth.

## 10. API and event contract principles

All APIs are versioned, authenticated, tenant-scoped and documented. Resource access is scoped by both `entity_id` and `platform_id`, plus any narrower account, seller, branch or order scope.

Initial resource families:

- `/v1/organisations`
- `/v1/buyer-accounts`
- `/v1/sellers`
- `/v1/catalogues`
- `/v1/products`
- `/v1/price-books`
- `/v1/quotes`
- `/v1/carts`
- `/v1/orders`
- `/v1/fulfilments`
- `/v1/returns`
- `/v1/marketplaces`
- `/v1/settlement-references`

These are proposed contract families, not existing live endpoints.

Candidate domain events include:

- `catalogue.product_published.v1`
- `pricing.quote_requested.v1`
- `pricing.quote_issued.v1`
- `commerce.order_submitted.v1`
- `commerce.order_approved.v1`
- `commerce.order_accepted.v1`
- `commerce.order_cancelled.v1`
- `inventory.reservation_confirmed.v1`
- `payment.status_verified.v1`
- `fulfilment.shipment_dispatched.v1`
- `fulfilment.delivery_confirmed.v1`
- `commerce.return_authorised.v1`

Events require stable IDs, schema versions, tenant/entity scope, actor or system identity, occurrence time, correlation ID, causation ID and provenance. Consumers must be idempotent. Sensitive personal or payment data must not be placed in general event payloads.

## 11. Security, privacy and governance

- FORTRESS is the independent policy authority; Commerce must not implement a competing permission engine.
- Enforce least privilege and deny-by-default access.
- Apply tenant isolation to every query, command, cache key, event and export.
- Separate buyer, seller, marketplace operator and internal support scopes.
- Require fresh authorisation for consequential actions.
- Use server-side secret references; never expose provider credentials to browsers or logs.
- Maintain append-only or tamper-evident audit evidence for commercial, administrative and financial actions.
- Apply data minimisation, purpose limitation, retention and deletion controls after approved legal/data-owner review.
- Protect against account takeover, price manipulation, cart/order tampering, inventory races, webhook forgery, replay, enumeration, fraud and seller abuse.
- Provide accessibility, secure session handling, rate limiting, abuse controls and safe error responses.
- AI tools are advisory by default. They cannot approve quotes, change contract prices, release stock, accept credit risk, issue refunds or publish listings without an explicit authorised workflow.

## 12. Software-first, owned-first deployment

Commerce must be portable and software-defined.

- Prefer reusable application services and software-defined infrastructure over dedicated commerce appliances.
- Support containerised and other approved portable execution models.
- Separate logical NODE identities from execution environments.
- Keep external hosting, payment, logistics, tax and messaging adapters replaceable.
- Support customer-controlled or IZAKHONO-controlled deployment where operationally and contractually appropriate.
- Do not make a specific cloud provider, proprietary marketplace SaaS, or physical server a mandatory architectural dependency.
- Do not claim that software eliminates the need for compute, storage, networking, connectivity, industrial devices or external regulated services.
- No infrastructure, licence, subscription, hardware or service spend without explicit owner approval.

## 13. Operational quality attributes

The implementation must define and test:

- availability and graceful degradation by capability;
- catalogue and search performance at realistic product volumes;
- bulk-order import limits and validation;
- order and payment idempotency;
- concurrency and stock-reservation correctness;
- event delivery, retries, replay and dead-letter recovery;
- reconciliation between Commerce, ERP, I-PAY, inventory and fulfilment;
- backup, restore and data portability;
- observability without leaking sensitive data;
- tenant isolation and authorisation tests;
- accessibility and responsive experience;
- migration and rollback strategy;
- performance and cost envelopes for software-first execution.

No numeric SLA, scale claim or capacity promise should be published until measured in a representative environment.

## 14. Phased delivery roadmap

### Phase 0 — Evidence and ownership reconciliation
- Inspect current ONE Commerce contract and prepare-only adapter.
- Inspect I-PAY, FLOW, CRM, ERP, Integration Fabric, LegacyMart and Builder Economy assets.
- Establish the canonical domain ownership matrix and data contracts.
- Identify reusable code, unfinished proposals, duplicate stores and actual runtime evidence.
- Confirm the first pilot use case and its owner-approved environment.
- Exit only when the inventory, gaps, dependencies and test strategy are reviewed.

### Phase 1 — Commerce core foundation
- Organisation and buyer account model.
- Seller/account model for a single-seller first release.
- Product catalogue and publication lifecycle.
- Price books and deterministic pricing snapshots.
- Cart and quote foundations.
- FORTRESS permission catalogue and audit integration contract.
- Tenant-isolation, domain and contract tests.

### Phase 2 — B2B purchasing and orders
- Account hierarchies and delegated users.
- RFQ, quote versions and approvals.
- Bulk and repeat ordering.
- Purchase-order references and order lifecycle.
- Inventory/ERP adapter contract and reconciliation.
- Order notification and customer status views.

### Phase 3 — I-PAY and fulfilment integration
- Verified payment intent/status contract.
- Refund and payment-reconciliation lifecycle.
- Warehouse, dispatch, delivery and proof-of-delivery contracts.
- Returns and customer service handoff.
- End-to-end failure, retry and duplicate-event tests.

### Phase 4 — Marketplace
- Seller onboarding and evidence gates.
- Seller catalogues and listing moderation.
- Multi-vendor cart/order splitting.
- Commission, seller statements and settlement references.
- Dispute, refund and seller performance workflows.

### Phase 5 — B2C, subscriptions and assisted selling
- Consumer storefront and checkout.
- Sales representative workspace.
- Subscription and recurring-order lifecycle.
- Promotions, loyalty and campaign integrations.

### Phase 6 — Intelligence and industry expansion
- Demand forecasting and replenishment suggestions.
- Assisted product discovery and sales support.
- Manufacturing/distributor-specific workflows.
- Industry packs and partner connector ecosystem.

Each phase has separate implementation, test, security, operational and release gates. A phase being documented does not imply it is implemented or active.

## 15. First recommended pilot

Start with a controlled, single-seller B2B commerce pilot rather than immediately attempting a global multi-vendor marketplace.

The pilot should prove:

1. a verified business buyer can be onboarded;
2. account users and purchasing authority are scoped correctly;
3. a published catalogue and customer-specific price book can be managed;
4. the buyer can request and accept a quote;
5. an authorised approver can approve the purchase;
6. the accepted order is created exactly once;
7. stock/availability is confirmed by its authoritative source;
8. payment is verified through I-PAY or an approved provider, or an explicitly configured invoice/credit route;
9. fulfilment status is recorded and communicated;
10. finance and order records reconcile;
11. all consequential actions are auditable and tenant-isolated.

LegacyMart may be assessed as a candidate storefront/reference tenant, but its current implementation and data contracts must be inspected before reuse. No migration or production switch is assumed.

## 16. Acceptance gates

The platform is not eligible for production until all applicable gates pass:

- reviewed domain ownership and data contracts;
- authenticated and FORTRESS-authorised API paths;
- tenant isolation tests for every resource family;
- quote, pricing and order lifecycle tests;
- idempotency and concurrency tests;
- payment provider/I-PAY verification and reconciliation tests;
- inventory and fulfilment adapter acceptance;
- security and privacy review;
- backup/restore and recovery evidence;
- accessible user journeys and supported-device testing;
- operational monitoring and incident procedures;
- explicit owner approval for deployment and any external commitments;
- real end-to-end acceptance evidence in the authorised execution environment.

## 17. Explicit non-goals and prohibitions

This architecture does not authorise:

- merging any existing draft pull request;
- deploying or activating Commerce in production;
- DNS, domain, routing or payment changes;
- opening merchant, seller or customer accounts;
- sending external communications;
- creating or changing financial transactions;
- committing to a vendor, logistics partner, licence or subscription;
- storing card data or operating regulated financial services without the appropriate approved structure;
- claiming customer references, integrations, certifications, service levels or production capacity without evidence.

## 18. Architecture decision summary

1. IZAKHONO COMMERCE is a first-party commercial domain, not a copy of VTEX.
2. ONE COMMERCE remains the SUPER APP access pillar; it is not a duplicate transaction system.
3. Commerce owns only explicitly assigned commerce-domain records.
4. I-PAY, FORTRESS, ID, FLOW, CRM, ERP, Integration Fabric, Runtime Fabric and HOST retain their respective authority boundaries.
5. B2B is a first-class model, including organisational purchasing authority, contract pricing, RFQs and approvals.
6. Marketplace is a later phase after single-seller order, payment and fulfilment integrity is proven.
7. Software-first and owned-first are mandatory architectural preferences, with external adapters replaceable and no silent spend.
8. All capabilities remain proposed until implemented, tested and independently evidenced.

---

**Founding principle:** WE DON'T BUY. WE BUILD. WE INTEGRATE. WE AUTOMATE. WE INTELLIGENTLY OPERATE. WE OWN.
