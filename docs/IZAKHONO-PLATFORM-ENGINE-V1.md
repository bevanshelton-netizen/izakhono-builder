# IZAKHONO PLATFORM ENGINE v1

Status: implementation baseline
Owner: IZAKHONO AFRICA
Architecture: owned-first, externally reversible

## Purpose
Turn IZAKHONO BUILDER into the reusable factory that provisions, operates, markets and scales independently deployable IZAKHONO products.

## Non-negotiable boundaries
- Every product keeps its own independently deployable engine.
- Product data, auth scopes, secrets and customer records remain isolated.
- Shared services are consumed through versioned interfaces; no product becomes another product's runtime.
- Owned infrastructure is primary. External providers are replaceable resilience/specialist adapters.
- No production secret enters generated source.
- No public-live claim without independent HTTPS/health verification.
- No behavioural tracking, advertising IDs, sale of customer data or silent analytics.
- EDU-BUILD is outside the IZAKHONO ownership/portfolio boundary, but may consume approved Platform Engine capabilities as an independent external tenant/customer.
- SHELTONAIR is private/stealth: public publishing and public Growth connectors disabled until explicit release.

## Platform fabric
CODE -> BUILDER -> CI/CD -> RUNTIME -> DATA -> AUTH -> STORAGE -> QUEUES/WORKERS -> SECURITY -> EDGE/TLS/CDN -> OBSERVABILITY -> SCALE -> BACKUP/RECOVERY

Shared capability adapters:
- IZAKHONO SUPER AI
- IZAKHONO GROWTH ENGINE
- portfolio CRM
- payments (iKhokha default where suitable; adapters replaceable)
- IZAKHONO SEND
- FORTRESS trust/fraud controls where appropriate

## Provisioning contract
A generated product must declare:
1. product_id and legal_entity
2. runtime profile and health endpoint
3. data isolation namespace/database
4. auth/RBAC policy
5. storage buckets
6. queues/workers and retry/dead-letter policy
7. secrets references (never secret values)
8. domain, EDGE/TLS and fallback route
9. observability and alert policy
10. backup/restore objective
11. CRM/payment/Growth/SUPER-AI adapters requested
12. privacy/telemetry policy
13. public/private launch state

## Lifecycle gates
DRAFT -> BUILD -> VALIDATE -> ALPHA -> STAGING -> READY -> LIVE VERIFIED

Promotion requires evidence. A failed gate returns to FIX; it never self-promotes.

## Failure isolation
A failure in FAISReady must not take down KORA, WorkNow or another product. Shared services require timeouts, bounded retries, circuit breakers and product-scoped credentials. Queue work is product-scoped.

## Growth integration
Growth Engine receives product-approved offers and conversion events through an adapter. It cannot bypass a product's READY gate. High-volume/public campaigns require verified CTA, payment/lead route, fulfilment and measurement.

## Initial commercial routing
- FAISReady: course conversion and iKhokha path
- IZAKHONO Clothing: quote generation and B2B follow-up
- AUTO AI: paid digital conversion and cross-sell
- WorkNow: employer/recruiter + job-seeker funnels
- KORA/Allegro: readiness-gated artist/audience/partner growth
- SHELTONAIR: PRIVATE; no public publishing
- EDU-BUILD: independent external tenant/customer; separate entity/ecosystem with dedicated engine, identity, data, auth, finance and operational boundaries

## v1 delivery slices
P1 Foundation: product manifest, isolation validator, health contract, deployment evidence.
P2 Runtime: worker/queue contract, auth/RBAC, data/storage, secrets references.
P3 Edge: domain/TLS, cache/CDN, rate limits, fallback switching.
P4 Operations: logs, errors, metrics, alerts, backup/restore evidence.
P5 Commercial adapters: CRM, payments, Growth Engine, SUPER AI.
P6 Factory command: provision a new product from one reviewed manifest.\nP7 External tenancy: provision an independent tenant with contractual capability grants and hard data/auth/finance isolation.

## Acceptance tests
- Generate two sample products with separate data/auth scopes.
- Build both through immutable Alpha policy.
- Stop one runtime; verify the other remains healthy.
- Deny cross-product data access.
- Exercise queue retry/dead-letter behavior.
- Verify no secret values in generated repository.
- Verify primary/fallback health independently.
- Verify private product cannot publish Growth campaigns.
- Produce machine-readable deployment evidence.

## Definition of done
v1 is not "live" because this document exists. It is complete only when the above acceptance tests pass on the target infrastructure and deployment evidence is retained.


## External tenant model

The Platform Engine supports organisations that are not IZAKHONO portfolio companies.

An external tenant:
- retains its own legal identity, brand, domains, customers/users and operational authority;
- receives a dedicated independently deployable application engine;
- receives dedicated data/auth/storage namespaces and product-scoped credentials;
- has explicit capability grants for CRM, Growth Engine, SUPER AI, payments, messaging and other shared services;
- cannot read or write any IZAKHONO portfolio tenant data;
- cannot inherit another tenant's payment destination, marketing consent, CRM contacts or analytics identity;
- can be detached/migrated without taking down the Platform Engine or another tenant.

### EDU-BUILD reference tenant

EDU-BUILD INSTITUTE – Shelton Campuses is the first independent external reference tenant.

Approved target capabilities:
- EDU-BUILD CRM
- student/campus acquisition funnels
- enrolment and admissions workflows
- online-learning integration
- EDU-BUILD shop/payment adapters
- communications
- reporting
- SUPER AI assistance
- Growth Engine workspace
- security, monitoring and backup

Required hard boundaries:
- EDU-BUILD student/customer data is never pooled with IZAKHONO portfolio data.
- EDU-BUILD financial/payment records and destinations remain EDU-BUILD scoped.
- EDU-BUILD branding/domains remain EDU-BUILD scoped.
- Growth audiences, consent and suppression lists remain EDU-BUILD scoped.
- EDU-BUILD runtime failure cannot take down an IZAKHONO product, and vice versa.

### External-tenant acceptance tests

- Provision EDU-BUILD reference tenant and one IZAKHONO internal tenant from separate manifests.
- Verify distinct auth issuers/scopes or equivalent hard tenant boundaries.
- Verify cross-tenant database/storage access is denied.
- Verify payment configuration cannot resolve across tenant boundary.
- Verify Growth contacts, consent and suppression data cannot resolve across tenant boundary.
- Stop EDU-BUILD runtime and verify internal tenant remains healthy; repeat in reverse.
- Export EDU-BUILD tenant configuration/data contract without exporting another tenant.
