# HCode Integration — Portable South African App-Hosting Adapter

**Status:** Evaluation and deployment preparation only  
**Provider:** HostAfrica HCode  
**Cost approval:** R0 authorised; no order, subscription, trial, paid resource, or production cutover is authorised  
**Architecture decision:** HCode is an optional application-hosting target, not the IZAKHONO owned-runtime foundation.

## 1. Purpose

Evaluate HCode as a South African-hosted deployment option for selected IZAKHONO applications and customer projects. Preserve source-code ownership, deployment portability, independent backups, and the ability to migrate to IZAKHONO-owned infrastructure.

HCode's public product material advertises GitHub/ZIP deployment, framework detection, Dockerfile builds, HTTPS, custom domains, managed PostgreSQL and Redis, background workers, backups, and rollback facilities. Confirm current capabilities and contractual terms in the account and technical documentation before relying on any feature.

Official references:
- Product and plans: https://hostafrica.co.za/hcode/
- Documentation: https://hcode.hostafrica.com/docs
- Dockerfile builds: https://hcode.hostafrica.com/docs/deploy/dockerfile
- Usage and limits: https://hcode.hostafrica.com/docs/billing/usage-and-limits
- Fixed limits: https://hcode.hostafrica.com/docs/reference/limits

## 2. Position in the IZAKHONO architecture

HCode may provide a temporary or customer-facing **application runtime**. It must not become the source of truth for our platform.

| Plane | IZAKHONO target | HCode relationship |
|---|---|---|
| Source and IP | IZAKHONO-controlled Git repositories | Connect as a deployment source; never make HCode the only copy |
| Application runtime | Portable containers and owned nodes | Optional hosted target for selected apps |
| Control plane | IZAKHONO HOST | Keep independent; do not make HCode organisation state our control plane |
| Database | Portable PostgreSQL schemas and migrations | Optional managed database for a pilot; retain tested export/restore path |
| Cache/queue | Portable Valkey/Redis-compatible adapter | Use only where app compatibility and plan capacity are verified |
| DNS and domains | IZAKHONO-controlled domain/DNS strategy | Custom-domain mapping only; do not delegate authoritative DNS by default |
| Edge and TLS | Owned Caddy/edge target | HCode-managed HTTPS may serve HCode-hosted app domains |
| Object storage | S3-compatible abstraction | Do not assume HCode database storage is object storage |
| Mail | Separate IZAKHONO mail plane | Do not treat app hosting as mailbox or deliverability infrastructure |
| Security | FORTRESS policies, secrets, audit and access controls | Map provider controls; retain application-level security and audit |
| Backup and recovery | Independent, tested backups and restore procedures | Provider backups are an additional layer, not our only recovery copy |

## 3. HCode plan facts to validate

The public pricing page currently advertises the following monthly plans:

| Plan | Price | Projects | Databases | RAM | Storage | Backup retention |
|---|---:|---:|---:|---:|---:|---:|
| Solo | R50 | 3 | 1 | 1 GB | 10 GB | 3 days |
| Developer | R200 | 5 | 3 | 4 GB | 20 GB | 7 days |
| Pro | R499 | 10 | 5 | 8 GB | 40 GB | 30 days |
| Team | R999 | 20 | 20 | 16 GB | 80 GB | 60 days |

All prices and allowances must be reconfirmed at order time. Annual billing, taxes, usage rules, resource sizing, build-minute limits, support terms and any other charges must be checked before purchase.

Important capacity behaviour from HCode's documentation:
- RAM is shared by running applications and databases in the organisation.
- A stopped application does not count towards running memory, but requires capacity to start again.
- A new database reserves storage (documented as 5 GB on creation).
- Reaching memory, storage or item limits can prevent new work or deployments.
- Bandwidth is described as unlimited subject to fair-use measurement.
- PostgreSQL allows up to 100 simultaneous connections per database according to the fixed limits page.

These constraints make a small, isolated pilot more appropriate than moving the full IZAKHONO platform at once.

## 4. Candidate pilot and deployment sequence

Do not choose a production-critical service for the first experiment. The initial candidate should be a small, stateless, customer-facing web application or demonstration with:
- a known build command and start command;
- no dependency on privileged host access;
- no dependency on a multi-container Docker Compose deployment;
- no customer personal or sensitive data;
- no production secrets or live payment processing;
- a health endpoint and a documented rollback;
- a reproducible build from the repository.

Candidate selection order:
1. A disposable demo or public-facing brochure/landing application.
2. A small, stateless IZAKHONO application after its build and runtime requirements are verified.
3. A database-backed pilot only after data export, restore and connection-security tests pass.

Do not assume the entire `docker-compose.owned.yml` stack can be deployed as one HCode project. HCode's documented Dockerfile build support is not proof that arbitrary Compose stacks, privileged containers, host networking, kernel modules, or every daemon are supported. Test each required service against the provider's current supported model.

## 5. Required pre-deployment checks

Before creating an HCode project:
- The owner must independently create or access a HostAfrica account.
- The exact plan, recurring price, billing cycle, taxes and cancellation terms must be reviewed.
- Written approval must be obtained for any spend; current authorised spend is R0.
- Confirm the app's language/runtime version, build command, start command, listening port and health-check behaviour.
- Confirm environment-variable and secret handling; never commit credentials to Git.
- Confirm the region and data-location commitments for the specific service and database.
- Review data processing terms, security documentation, POPIA implications and incident/support procedures.
- Confirm database backup retention, export method, restore method and independent off-platform backup process.
- Confirm resource limits, build-minute allowance, database connection limits and what happens when a quota is exceeded.
- Confirm domain ownership and DNS changes required; do not change production DNS during a pilot.
- Define rollback and migration procedures before the first deployment.

## 6. Deployment procedure after explicit approval

1. Select a non-critical pilot repository and pin the intended branch/commit.
2. Verify a clean build locally or in an existing free development environment.
3. Add a deployment-specific Dockerfile only if framework auto-detection is insufficient and the provider supports the required Dockerfile features.
4. Create the HCode project only after the owner approves the exact plan and recurring charge.
5. Configure secrets through the provider's secret/environment-variable interface.
6. Deploy to the generated HCode subdomain first.
7. Run smoke, security, performance, accessibility and functional checks.
8. Test rollback to the last known-good deployment.
9. Test database export and restore if a database is involved.
10. Record the deployed commit, configuration, provider limits, test evidence and known limitations.
11. Only after acceptance, consider a custom domain and customer-facing production traffic.

No live deployment, subscription, domain change, or production migration is implied by this document.

## 7. Portability and exit requirements

Every HCode-hosted application must remain migratable:
- Source remains in the IZAKHONO-controlled repository.
- Build and run instructions are documented in the repository.
- Runtime configuration is expressed through portable environment variables.
- Secrets can be rotated independently of the provider.
- Database schema and migrations are provider-neutral.
- Data can be exported and restored outside HCode.
- Persistent user uploads use a portable storage abstraction, not an undocumented local filesystem assumption.
- Health checks and acceptance tests run independently of the provider.
- DNS can be redirected without changing application ownership.
- A migration/exit runbook is maintained.

## 8. Cost and production truth

**Current approved HCode spend: R0.** The advertised R50/month plan is not free. Do not click an order flow, activate a subscription, enter payment details, or create a paid resource without explicit owner approval.

HCode is a managed hosting provider, not our owned mega-server. A successful HCode deployment proves only that the selected application runs on HCode. It does not prove that IZAKHONO HOST, our own DNS, mail plane, FORTRESS, or multi-node infrastructure is live.

## 9. Decision

Adopt HCode as an **optional, evaluated deployment adapter** for selected South African workloads. Do not replace the owned-first architecture, do not migrate the full platform, and do not spend before revenue and explicit approval.

**Operating principle: Own the code. Keep the exit route. Let revenue fund infrastructure.**
