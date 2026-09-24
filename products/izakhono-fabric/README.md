# IZAKHONO APP FABRIC

Shared application-services contract for the full IZAKHONO portfolio.

## Why it exists

The portfolio should not rebuild the same backend, permissions, file handling, payment handoff, notifications, AI adapters, recurring workflows, CRM or release logic inside every product.

APP FABRIC makes those capabilities available through one owned-first service contract while allowing each platform to keep its own brand, product UX, data rules and legal entity.

This is an original IZAKHONO architecture. It does not copy Hercules branding, source code, illustrations or proprietary implementation.

## Standard capability surface

Every newly registered IZAKHONO app now receives the Builder baseline for:

- CRM / lead capture
- accounts and authentication
- backend/data foundation
- file and media storage
- payment orchestration boundary
- email
- notifications
- chat
- AI assistant routing
- AI speech generation adapter
- AI transcription adapter
- recurring / conditional workflows
- roles and permissions
- API / connector integrations
- admin dashboard
- first-party analytics
- publish/release planning
- CEO growth engine

A capability being present in the application plan does **not** mean it is automatically enabled in production. Money movement, public messaging, regulated workflows, protected data, mobile-store submission and external connectors remain fail-closed until their individual readiness gates pass.

## Existing owned components

APP FABRIC composes existing IZAKHONO components rather than replacing them:

| Capability | Primary IZAKHONO component |
|---|---|
| Backend, auth, storage, scoped policy, realtime primitives | IZAKHONO Core |
| CRM, contacts, pipelines, activities | IZAKHONO CRM |
| Payments | IZAKHONO PAY / verified iKhokha route where approved |
| Subscription entitlements | IZAKHONO ACCESS |
| AI routing | IZAKHONO AI GATEWAY |
| Scheduling | IZAKHONO TASKS |
| Condition/API execution | IZAKHONO RUNNER |
| File transfer | IZAKHONO SEND |
| Build/release recipes | IZAKHONO BUILDER / CODE / Runtime |
| Security boundary | FORTRESS / Access / EDGE |
| Revenue workflow | IZAKHONO REVENUE |

Missing or incomplete adapters are represented explicitly in `capabilities.json`; they are never silently treated as production-ready.

## Scale principle

The architecture is **scale-ready**, not "millions guaranteed."

Stateless frontends and APIs may scale horizontally or serverlessly, while stateful services use PostgreSQL/object storage/queues and health-aware workers. Promotion to a higher scale tier requires measured load evidence for the actual product, region and workload.

No marketing page may claim a verified user or request capacity merely because the architecture supports horizontal scaling.

## Governance principle

All shared services must preserve:

- `entity_id` isolation;
- `platform_id` isolation where a service spans multiple products;
- role/scope policy;
- audit events;
- least-privilege service credentials;
- protected-data minimisation;
- explicit external-connector authorisation.

The same person appearing in two businesses does not automatically become one cross-company customer record.

## Publish principle

"Publish" has three separate evidence tracks:

1. **Web/PWA** — build, health, domain, DNS and TLS proof.
2. **Android** — signed package plus Play Console submission/release evidence.
3. **iOS** — signed package plus App Store Connect submission/release evidence.

The first can be automated on owned/external infrastructure. Store publication still requires the relevant developer accounts, signing keys, policies and store approvals. APP FABRIC must not label a mobile release public until those checks exist.

## Owned-first topology

```text
Platform
  -> IZAKHONO APP FABRIC contract
      -> Core / CRM / Pay / Access / AI / Tasks / Runner / Send / Revenue
  -> FORTRESS / Access
  -> Runtime
  -> EDGE / TLS
  -> IZAKHONO DNS
```

NODE01 remains the primary owned target. Approved external infrastructure remains reversible resilience under the portfolio infrastructure directive.

## Usage

Resolve the standard plan for a product:

```bash
node products/izakhono-fabric/resolve.mjs faisready
```

Resolve a media product:

```bash
node products/izakhono-fabric/resolve.mjs kora
```

The resolver returns capability status and explicit production blockers. It never upgrades a `prepared` or `planned` capability to `verified`.
