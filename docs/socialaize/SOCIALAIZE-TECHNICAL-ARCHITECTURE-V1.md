# SOCIALaiZe — Technical Architecture V1

**Status:** Proposed logical architecture; implementation choices subject to Gate 0 verification  
**Architecture principle:** Reuse canonical IZAKHONO services; provider-neutral; owned-first; externally reversible.

## 1. Architectural decisions

- SOCIALaiZe is a separate product identity and commercial offering.
- Commercial and IZAKHONO editions use shared product capabilities with strict tenant, entity and platform isolation.
- IZAKHONO ID / FORTRESS remain authoritative for identity, authorisation, secrets and audit where integrated.
- IZAKHONO CREATE remains the required creative source of record for IZAKHONO portfolio marketing under `IZAKHONO-MARKETING-CONTROL-DIRECTIVE.md`.
- IZAKHONO ADS remains the distribution, campaign mutation and spend-control layer for portfolio marketing.
- Existing CRM remains the customer/opportunity system of record.
- Existing PAY services remain the payment and financial orchestration boundary.
- Social networks, Metricool and AI model providers are adapters, not authorities for SOCIALaiZe's canonical product data.
- No new production database or migration is authorised by this specification.

## 2. Logical layers

1. **Experience:** responsive web app, workspace dashboard, agency portal and enterprise administration.
2. **Product API:** versioned API contracts, request validation, idempotency and domain orchestration.
3. **Control plane:** workspace tenancy, memberships, entitlements, policies, approval rules and audit references.
4. **Domain capabilities:** brands, content, calendars, campaigns, publishing, conversations, analytics and leads.
5. **AI orchestration:** provider-neutral model adapters, task routing, structured outputs, safety filters and cost attribution.
6. **Integration adapters:** social network OAuth, publishing, analytics, CRM, CREATE, ADS and PAY interfaces.
7. **Data plane:** relational records, object/media storage, queues, event/outbox records and analytics aggregates.
8. **Operations:** observability, backup, recovery, deployment, incident response and compliance evidence.

## 3. Deployment shape

Start with a modular application and separately bounded workers for long-running tasks. Do not prematurely split every module into a microservice. Separate web/API, scheduled publishing workers, webhook intake and media processing where scaling, security or reliability justify it.

Target deployment is IZAKHONO-owned infrastructure through verified authorised runtime interfaces. External providers may be used only as approved, reversible adapters. GitHub, Vercel, Supabase or any other SaaS must not silently become a required runtime authority.

## 4. Canonical integration map

| Capability | Preferred canonical owner / reuse target | SOCIALaiZe responsibility |
|---|---|---|
| Identity and sessions | IZAKHONO ID / FORTRESS | Consume verified principal and scopes |
| Entity and platform boundary | IZAKHONO CORE / entity policy | Carry verified entity and platform context |
| Creative source of record | IZAKHONO CREATE | Request/consume approved campaign packages |
| Campaign distribution and spend | IZAKHONO ADS | Submit approved distribution intents |
| Social channel control | SOCIAL COMMAND / marketing OS | Integrate after current branch and API audit |
| AI creative media | IZAKHONO CREATOR and approved AI runtime | Orchestrate via authorised capability contracts |
| Leads and opportunities | IZAKHONO CRM | Consent-aware intake and scoped handoff |
| Billing and payments | IZAKHONO PAY / commercial systems | Consume approved subscription/entitlement contracts |
| Runtime and deployment | IZAKHONO HOST / Runtime Fabric / DEPLOY | Use verified runtime lifecycle contracts |

The exact canonical CREATE product implementation and the current SOCIAL COMMAND branch-to-main status remain verification items. Do not infer readiness from documentation or branch names.

## 5. Integration pattern

Every external or internal provider is represented by a versioned adapter contract with:
- declared capabilities and scopes;
- lifecycle state (planned, configured, verified, active, disabled);
- server-side credentials and secret references;
- tenant/entity ownership;
- health and token-expiry state;
- rate limits and provider error mapping;
- idempotency and bounded retry rules;
- webhook signature verification;
- audit references and revocation path.

A provider listed in a registry is not thereby connected or production-ready.

## 6. Async execution

Publishing, media generation, webhook handling and analytics ingestion are asynchronous workflows. Use durable job records, leases, idempotency keys, bounded retries, dead-letter/manual review, reconciliation and append-only audit events. A submission is not completion; a provider acknowledgement is not proof that a public post is visible.

## 7. API boundary

All write routes require authenticated server-derived tenant context, resource-level authorisation, schema validation, CSRF/origin protection where applicable, idempotency for retryable commands, rate limiting and audit. Browser clients never receive provider secrets or privileged service credentials.

## 8. Observability

Capture correlation IDs, workspace/entity/platform context, provider, capability, job ID, attempt count, state transition, latency and sanitised error category. Never log access tokens, refresh tokens, passwords, private message bodies or unnecessary personal data.

## 9. Architecture gates

Before implementation: verify canonical service contracts, repo owners, runtime, database authority, migration process, secrets manager, queue, storage, deployment permissions, provider API terms and data residency requirements. If a dependency is not verified, keep its adapter disabled or manual.
