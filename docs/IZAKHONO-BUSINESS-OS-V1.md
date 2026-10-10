# IZAKHONO BUSINESS OS v1

## Purpose

IZAKHONO BUILDER is no longer defined as an application generator only. It is the control plane for creating, provisioning, securing, releasing and operating complete digital businesses.

The core product contract is:

> **Describe the business once. IZAKHONO plans the system, assembles the application fabric, provisions the required services, validates the result and produces a controlled release candidate.**

## Architectural position

```text
BUSINESS INTENT
      |
      v
+-------------------------+
| IZAKHONO ORCHESTRATOR  |
| classify -> plan ->     |
| assemble -> validate    |
+-----------+-------------+
            |
   +--------+---------+-------------------+
   |                  |                   |
   v                  v                   v
APP FABRIC         HOST / PROVISIONER   FORTRESS
frontend/API       domains/DNS/SSL      security/policy
DB/storage         mail/runtime         identity/audit
payments           releases             resilience
CRM/comms          observability        recovery
   |                  |                   |
   +------------------+-------------------+
                      |
                      v
              RELEASE CANDIDATE
                      |
              evidence-gated publish
                      |
                      v
                 LIVE BUSINESS
```

## Capability contract

The minimum business-building fabric contains these layers:

1. **Intent** — natural-language business brief and constraints.
2. **Planning** — classify business type, infer capabilities and produce a deterministic build plan.
3. **Application Fabric** — frontend, APIs, business logic and reusable product modules.
4. **Data** — relational data model, migrations, storage and backups.
5. **Identity** — authentication, organizations, roles, scopes and row-level authorization.
6. **Commerce** — products/offers, checkout/payment intents, subscriptions, invoices and reconciliation hooks.
7. **Customer Operations** — CRM, leads, support, notifications and communication workflows.
8. **AI Fabric** — provider-neutral AI capability adapters with server-side secrets and usage controls.
9. **Domain & DNS** — domain onboarding, DNS plan generation and verification gates.
10. **Web Delivery** — hosting, caching/CDN, SSL/TLS and release channels.
11. **Email** — business mailbox and transactional-email provisioning adapters.
12. **Security** — FORTRESS policy boundary, audit events, rate limits, firewall hooks and secret isolation.
13. **Reliability** — health checks, backups, rollback, failover and recovery evidence.
14. **Observability** — logs, metrics, traces, errors and deployment evidence.
15. **Scaling** — capacity policy, queues, concurrency and provider failover.
16. **Growth** — SEO, analytics, acquisition, activation, retention, referrals and revenue instrumentation.
17. **Distribution** — web/PWA, mobile packaging gates and controlled release metadata.
18. **Governance** — owner approvals, immutable build receipts and evidence-gated public-live state.

## Owned-first rule

The preferred execution order is:

1. IZAKHONO-owned runtime/infrastructure.
2. IZAKHONO-owned application fabric and data services.
3. Approved replaceable external adapters where owned capacity is not yet available.
4. External providers are never allowed to become the sole source of truth when an IZAKHONO-controlled source can be maintained.

Every external dependency must have an adapter boundary and a reversible path.

## One-sentence build contract

`POST /api/build-anything` remains the primary machine interface for turning a short business brief into a planned/generated/validated internal application snapshot.

The next evolution is to make the resulting recipe a **Business OS Plan**, not merely an application recipe. The plan must enumerate application modules, infrastructure services, security controls, commerce requirements, domain/mail requirements, observability, release gates and fallback routes.

## Release states

```text
draft
  -> planned
  -> building
  -> validated
  -> deploy_ready
  -> deployed
  -> paused
```

`deployed` means only that the deployment operation has been verified. `public_live` is a separate evidence-gated state and must never be inferred from source generation or a successful CI build.

## Non-negotiable controls

- No production secrets in source control.
- No arbitrary shell execution from Owner UI input.
- No automatic public publication from an unvalidated build.
- No invented deployment, DNS, SSL, mailbox or payment state.
- No external provider becomes the permanent architectural owner by accident.
- Every generated business has a deterministic build receipt.
- Every release candidate records its source revision and infrastructure gates.
- Rollback and failover remain first-class capabilities.

## First commercial path

The first marketable version should target the lowest-friction business types:

- service business website + lead capture;
- school/store ordering portal;
- professional services portal;
- membership/community platform;
- course/learning platform;
- commerce/catalogue site;
- creator/media platform.

These use the same fabric. Only the business modules and presentation change.

## Success metric

The product is successful when the same underlying platform can produce multiple IZAKHONO products without rebuilding their infrastructure manually.

**Build the machine. Then let the machine build the businesses.**
