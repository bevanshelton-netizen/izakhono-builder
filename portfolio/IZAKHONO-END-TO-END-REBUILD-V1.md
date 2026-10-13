# IZAKHONO END-TO-END REBUILD V1

## Directive

Rebuild blocked or dependency-fragile IZAKHONO businesses from a clean, owned-first baseline instead of repeatedly repairing deployments that are trapped behind provider limits, DNS failures, quota failures, or undocumented configuration.

## Non-negotiable operating rules

1. Business logic must live in IZAKHONO-controlled source and data stores.
2. External providers are adapters, not the source of truth.
3. A provider outage must not destroy customer/business state.
4. Every application gets a deterministic local development path and a portable production package.
5. Every application gets health checks, smoke tests, seed/demo data where appropriate, and a deployment receipt.
6. `live` is never inferred from a successful build. It requires URL/DNS/TLS/application acceptance evidence.
7. Payment, legal, regulated, store-signing, and account-permission gates remain explicit human authorization gates.
8. Email delivery is opt-in and must not silently route to the owner's Gmail.
9. Prefer IZAKHONO-owned runtime, database, storage, DNS and provisioning; maintain reversible external adapters.
10. When a project is blocked, rebuild the replaceable layer rather than repeatedly retrying the same blocked provider path.

## Portfolio rebuild tracks

### Tier 0 — Infrastructure foundation
- IZAKHONO DNS / authoritative DNS
- IZAKHONO HOST
- IZAKHONO Provisioner
- IZAKHONO internal repositories/source registry
- IZAKHONO deployment/health evidence
- backup and disaster-recovery manifests

### Tier 1 — Revenue-critical applications
- Allegro VIBEZ
- FAISReady
- CashFlow Guardian
- IZAKHONO Growth
- IZAKHONO Business Command

### Tier 2 — Network/media platforms
- KORA Network
- KORA TV
- THE VOICE / Allegro radio
- I-CONNECT

### Tier 3 — Business operating systems
- Manufacturing Command Centre
- Edu-Build Institute operating platform
- KG Industrial operating platform
- Free Bird Agri-Quip operating platform
- Classique Furniture operating platform

### Tier 4 — Strategic products
- IZAKHONO NAV
- FORTRESS
- SHELTON mobility/vehicle ecosystem
- Global Value Network
- IZAKHONO AI / opportunity economy products

## Standard application contract

Each rebuilt application must provide:

- `/health` — deterministic health endpoint
- `/ready` — dependency readiness endpoint
- `/version` — build and source identity
- authenticated owner/operator route
- customer-safe error handling
- structured audit events
- portable environment configuration
- database schema/migrations
- seed/test fixtures
- smoke-test script
- deployment manifest
- rollback target
- provider adapter interfaces
- no hard dependency on a single CDN, DNS provider, database provider, or deployment platform

## Rebuild sequence

1. Inventory current product requirements and verified assets.
2. Freeze the business rules and customer-facing promise.
3. Extract or reconstruct reusable business logic.
4. Build the core application locally/portably.
5. Put state into IZAKHONO-controlled persistence.
6. Add provider adapters only after the core works without them.
7. Add automated health and smoke tests.
8. Deploy to the preferred IZAKHONO runtime when externally reachable.
9. Use Vercel/other providers only as reversible transition capacity.
10. Attach DNS only after the application is already healthy.
11. Verify HTTPS, routes, persistence, payments and critical user journeys.
12. Record evidence and promote status.

## Failure policy

- Build failure: fix source.
- Provider quota failure: switch adapter/runtime.
- DNS failure: use IZAKHONO DNS or verified temporary secondary.
- Database/provider failure: restore from owned data and switch adapter.
- Payment provider failure: keep order/payment state and expose alternate approved gateway.
- Email provider failure: preserve outbound messages in a queue and switch provider.
- Missing account permission: stop only that external action; continue all build work.

## Definition of end-to-end complete

A business is complete only when its core user journey works from entry to value/revenue, data persists, operator controls work, failure handling exists, health evidence exists, and the deployment can be reproduced without the original blocked provider.

## Current principle

**Do not spend the next month repairing yesterday's infrastructure. Build the IZAKHONO-owned path once, then reuse it across the portfolio.**
