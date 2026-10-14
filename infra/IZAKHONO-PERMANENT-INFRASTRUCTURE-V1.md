# IZAKHONO PERMANENT INFRASTRUCTURE v1

## Mission

Replace recurring hosting, deployment, DNS, SSL, integration and provisioning blockers with one reusable IZAKHONO production platform.

**Rule:** IZAKHONO-owned infrastructure is the primary production foundation. External providers are adapters/fallback capacity and must remain replaceable.

## Platform layers

1. **IZAKHONO CODE** — canonical source, versioning and release metadata.
2. **IZAKHONO BUILDER** — product/module factory and build planner.
3. **IZAKHONO PROVISIONER** — typed provisioning engine for domains, DNS, certificates, runtime, databases, storage, mail, payments, CRM and monitoring.
4. **IZAKHONO CLOUD** — owned runtime/control plane. Target topology is N+3 nodes rather than a NODE01 single point of failure.
5. **IZAKHONO EDGE** — owned ingress/load-balancing/TLS layer with authoritative DNS under IZAKHONO control where operationally available.
6. **IZAKHONO DATA** — PostgreSQL-compatible database, object storage, cache/queue and backups under owned control.
7. **FORTRESS** — identity, secrets, access policy, audit and security controls.
8. **OBSERVABILITY** — health, logs, uptime, deployment receipts and evidence.
9. **FALLBACK ADAPTERS** — Cloudflare/Vercel/other providers only as reversible capacity, never as the source of truth.

## Universal application contract

Every IZAKHONO application declares:

- application name and slug;
- source revision;
- build context and Dockerfile;
- runtime port and health endpoint;
- required data/auth/payment dependencies;
- owned runtime target;
- public route;
- rollback target;
- backup and restore evidence;
- current evidence-based status.

Applications do not own their infrastructure. They consume platform services through stable contracts.

## Single production pipeline

`SOURCE → PLAN → BUILD → VALIDATE → PACKAGE → REGISTER → PROVISION → DEPLOY → HEALTH → HTTPS → ACCEPTANCE → PROMOTE → LIVE → MONITOR → ROLLBACK`

Every stage produces a machine-readable receipt. A later stage cannot claim success when an earlier mandatory gate failed.

### Gate rules

- **BUILD:** reproducible container/artifact generated.
- **VALIDATE:** manifest, dependency, secret and security checks pass.
- **PACKAGE:** immutable artifact digest recorded.
- **REGISTER:** release registered with IZAKHONO control plane.
- **PROVISION:** required typed infrastructure jobs complete.
- **DEPLOY:** artifact placed on an owned runtime target.
- **HEALTH:** application health endpoint passes.
- **HTTPS:** public route and TLS are verified.
- **ACCEPTANCE:** application-specific smoke tests pass.
- **PROMOTE:** release is explicitly promoted from candidate to production.
- **LIVE:** only issued when production HTTPS, health and acceptance evidence exists.
- **ROLLBACK:** previous verified release remains addressable.

## Failure replacement model

| Old blocker | Permanent IZAKHONO replacement |
|---|---|
| Vercel/Netlify quota | Owned runtime nodes + replaceable deployment adapters |
| DNS troubleshooting | IZAKHONO DNS plan + typed DNS adapter + verification gate |
| Manual SSL | Automated certificate job + HTTPS verification |
| Manual email setup | Mailbox service contract + provisioning job |
| Provider-specific deployment | Container artifact + runtime adapter |
| Scattered environment variables | FORTRESS-managed secrets/config contract |
| Repeated integrations | Shared platform APIs/adapters |
| Unknown live status | Evidence-based release receipts |
| Manual rollback | Previous verified release pointer |
| One-node failure | N+3 runtime topology + restore/rollback evidence |

## The permanent rule

A platform team should never solve the same infrastructure problem separately for FAISReady, Allegro Vibez, KORA, Edu-Build or the next application.

The platform solves the problem once. Applications consume the solution.

## Current implementation priority

1. Harden the existing IZAKHONO BUILDER as the release control plane.
2. Harden IZAKHONO HOST/PROVISIONER as the infrastructure control plane.
3. Standardise the release contract and universal production workflow.
4. Establish the owned runtime node contract and N+3 topology.
5. Move FAISReady and Allegro Vibez through the same pipeline.
6. Only then migrate additional platforms onto the common foundation.

## Evidence standard

Never label an application `LIVE` because source exists, a preview exists, or a deployment command succeeded. `LIVE` requires public HTTPS + health + acceptance evidence stored with the release receipt.
