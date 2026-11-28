# IZAKHONO COMMERCE PHASE 0 — SOURCE RECONCILIATION V1

**Date:** 2026-11-26  
**Status:** Source inspection record; implementation not started  
**Related architecture:** IZAKHONO COMMERCE Platform Architecture V1 (PR #768)  
**Principle:** WE DON'T BUY. WE BUILD. WE INTEGRATE. WE AUTOMATE. WE OWN.

## 1. Purpose and limits

This record captures a focused read-only inspection of the current `main` source for the Commerce service registry, SUPER APP module registry, LegacyMart storefront and I-PAY. It separates repository evidence from runtime claims.

This is not a production deployment, live endpoint test, security audit, payment-provider verification, database inspection, legal review or performance test. Source code and architecture records alone do not prove a service is live or operational.

## 2. Verified repository findings

### 2.1 IZAKHONO ONE service registry

Source: `products/izakhono-one/public/registry.json`

The registry contains an `izakhono-commerce` service entry:
- Name: IZAKHONO COMMERCE
- Description: catalogue, orders and payments services
- Status: `gated`
- Public URL: `null`

**Conclusion:** Commerce is recognised in the service catalogue but is not advertised there as an accessible public service.

### 2.2 SUPER APP module registry

Source: `products/izakhono-super-app/public/module-registry.json`

The current module list includes existing capabilities such as FLOW, CRM, Finance Core and other modules. It does not contain a Commerce module entry.

**Conclusion:** The service registry entry and SUPER APP module exposure are not yet connected. Do not claim a Commerce user-facing module is integrated until a canonical module contract, route, service adapter and tests exist.

### 2.3 LegacyMart storefront

Sources:
- `public/legacymart/index.html`
- `public/legacymart/health.json`

The storefront is a static HTML/CSS/JavaScript experience. Its catalogue loader reads the public Supabase REST endpoints for `lm_shops` and `lm_listings`, filters for active shops and published listings, and falls back to four hard-coded product cards if the catalogue request fails.

The fallback listings explicitly set `checkout_enabled: false`. The interface disables the Buy button and labels products as “Ordering soon”; the inspected code does not implement checkout or order creation.

The health document reports:
- `environment: external-bridge`
- `payments: not-enabled`
- `data_source: Supabase WebStart public RLS catalogue`
- `owned_target: NODE01 via IZAKHONO EDGE/TLS`

The embedded Supabase publishable key is a browser-facing public key, not a server secret. Its presence nevertheless documents an external catalogue dependency that must be evaluated and replaced or deliberately retained behind an approved adapter.

**Conclusion:** LegacyMart is a useful storefront/reference catalogue and migration candidate. It is not evidence of an operational transactional marketplace. A health status of `ok` describes the storefront health record, not payment or checkout readiness.

### 2.4 I-PAY payment boundary

Sources:
- `products/izakhono-pay/README.md`
- `products/izakhono-pay/src/index.js`
- Open work: PR #732 (cross-device merchant workspace), PR #677 (controlled launch readiness)

The I-PAY README defines a payment-intent lifecycle, idempotency, provider adapters, signed webhook ingestion, event/ledger metadata, refund and settlement/reconciliation records, merchant dashboard and sandbox mode. It states that regulated providers handle regulated money movement until IZAKHONO is appropriately authorised.

The inspected main-branch Worker source includes merchant API-key hashing/authorization, payment-intent lookup and idempotency lookup, provider event recording and a paid-state transition that dispatches merchant payment notifications. This source-level evidence does not establish production credentials, provider activation, successful live payments or regulatory readiness.

**Commerce boundary:** Commerce owns order and commercial state. I-PAY owns payment intent/provider lifecycle and verified payment evidence. Commerce must store references and verified status, not card credentials or a competing payment ledger. Payment success must come from authenticated, signature-verified provider evidence or an authoritative I-PAY result—not a browser redirect.

### 2.5 Integration Fabric

PR #766, **IZAKHONO Integration Fabric architecture v1**, remains open and draft.

Its architecture record describes existing internal patterns and the need for a durable, tenant-aware integration/message lifecycle. It does not establish that a production-grade enterprise connector/event backbone is merged, deployed or operating.

**Conclusion:** Commerce should define versioned domain commands/events and adapt to Integration Fabric through a contract. It must not assume a durable enterprise bus is already available.

### 2.6 Commerce architecture proposal status

PR #768, **IZAKHONO COMMERCE platform architecture v1**, is open and draft, not merged.

A compare against current `main` reported the Commerce branch as diverged: 2 commits ahead and 7 commits behind. The branch requires reconciliation with current mainline before merge. This source-reconciliation report is created on a fresh branch from current `main` so it does not compound the stale branch.

## 3. Domain ownership decisions

| Domain | Authoritative owner |
|---|---|
| Product listings and commercial catalogue | Commerce catalogue domain; source connectors may import data |
| Customer relationship, lead and opportunity | CRM |
| Quote, cart, accepted price snapshot and order | Commerce |
| Stock, reservation, valuation and manufacturing availability | ERP / inventory / MES authority through integration |
| Payment intent, provider status, webhook verification, refund and settlement evidence | I-PAY |
| Accounting journal, receivables, tax ledger and financial close | Finance / ERP |
| Cross-product workflow | FLOW |
| Identity, authorisation and policy | IZAKHONO ID / FORTRESS |
| Durable cross-system delivery and connector lifecycle | Integration Fabric, when its contract and runtime are verified |
| Execution substrate | HOST / authorised runtime; NODE identities remain software, not hardware |

## 4. Recommended implementation sequence

### Phase 1 — Single-seller commerce core

Build a narrow, testable vertical slice before multi-vendor marketplace features:

1. Tenant/seller and buyer organisation boundaries.
2. Product catalogue with stable SKU, unit, currency and publication state.
3. Server-side price calculation and immutable quote/order pricing snapshot.
4. Cart validation and order submission.
5. Idempotent order creation and explicit order state machine.
6. Durable order event/outbox contract with correlation IDs.
7. Owner/tenant-scoped API authorization and audit.
8. Contract tests for ERP/inventory and I-PAY adapters; adapters remain disabled until configured and verified.

The first pilot should be single-seller B2B with purchasing authority and approval rules. Use LegacyMart as a storefront/reference and catalogue migration case only after its external catalogue dependency and data ownership are deliberately resolved.

### Phase 2 — Controlled integrations

- Inventory availability and reservation from the authoritative ERP/inventory system.
- Payment initiation through I-PAY; payment status only from verified evidence.
- Fulfilment and delivery events through versioned integration contracts.
- Finance reconciliation by references and events, not a duplicate Commerce ledger.

### Phase 3 — Expand channels and marketplace

Only after the single-seller order lifecycle passes its acceptance gates:
- sales-assisted quoting;
- B2C and repeat ordering;
- vendor onboarding and seller sub-orders;
- commissions, seller statements and settlement controls;
- multi-vendor carts and split fulfilment.

## 5. Minimum acceptance gates

Before a first controlled pilot:
- tenant and organisation isolation tests pass;
- unauthorised users cannot view, price, approve or order for another organisation;
- pricing is server-side and accepted commercial terms are immutable;
- duplicate order requests do not create duplicate orders;
- order state transitions are validated and audited;
- failures in downstream delivery are retried/reconciled without losing accepted orders;
- stock availability is sourced from its authority and is not invented;
- payment status cannot be set by a client or unverified webhook;
- secrets and payment credentials remain server-side;
- integration tests use synthetic data and sandbox providers;
- runtime, domain, security and deployment readiness are separately verified before production activation.

## 6. Phase 0 result

**Completed:** source-level reconciliation of the Commerce registry, SUPER APP module registry, LegacyMart storefront/health record, I-PAY README and Worker source, and relevant open architecture/launch PR status.

**Not performed:** application tests, live HTTP probes, production configuration inspection, database access, provider credential checks, deployment, DNS changes, external communication or expenditure.

**Decision:** Proceed with the single-seller B2B Commerce core as the first implementation milestone. Do not begin multi-vendor marketplace settlement or enable checkout until order integrity, I-PAY verification and authoritative inventory/finance contracts are proven.

