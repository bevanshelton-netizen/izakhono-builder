# IZAKHONO Edge & Hosting Platform — Architecture Decision Record 0001

Status: Accepted direction; implementation is phased and not yet deployed.
Date: 27 November 2026
Scope: Shared infrastructure for IZAKHONO products, beginning with the ISBN & Publishing Registry.

## Decision

IZAKHONO will own and operate its platform layer instead of making Cloudflare a required runtime, DNS, security, or data-plane dependency. The internal platform working name is **IZAKHONO Edge**.

The current Cloudflare Worker + D1 implementation is a prototype/runtime adapter only. It is not the target production architecture and must not be represented as self-hosted infrastructure. Preserve application/domain logic and isolate provider-specific bindings so the registry can move to the IZAKHONO platform without rewriting its business rules.

## Target capability map

| Capability | Initial open-source foundation | Responsibility |
|---|---|---|
| Authoritative DNS | PowerDNS Authoritative | IZAKHONO-managed zones, records, DNSSEC |
| DNS recursion/resolution | Unbound | Private/internal resolution; never expose an open resolver |
| TLS and ingress | Caddy or Traefik | Automated certificates, routing, service ingress |
| Reverse proxy/cache | NGINX or Varnish | HTTP caching and origin protection |
| Web application firewall | Coraza with OWASP CRS | Managed request filtering and security rules |
| Workload runtime | Containers (Podman or Docker) | Isolated services and repeatable deployments |
| Relational database | PostgreSQL | Registry data, migrations, backups and recovery |
| Object/file storage | S3-compatible self-hosted storage (e.g. MinIO) | Documents, ISBN evidence and publication assets |
| Observability | Prometheus + Grafana + Loki | Metrics, dashboards, logs and alerting |
| Backups | Encrypted, versioned off-node backups | Tested restore and disaster recovery |

Component selection is provisional until compatibility, maintenance, licensing, security and resource requirements are reviewed. Avoid unnecessary duplication: choose one ingress/proxy path for the first release.

## Trust boundaries and security

- Separate public ingress, application workloads, databases, management interfaces and backup storage.
- Do not expose PostgreSQL, container APIs, internal DNS recursion or management endpoints to the public internet.
- Management access must require strong authentication and organisation-controlled authorisation; use MFA and least privilege where supported.
- Use TLS for external traffic and service-to-service links where appropriate.
- Store secrets outside source control; rotate them and audit access.
- Apply WAF rules in monitor mode first, tune false positives, then enforce.
- Rate-limit public endpoints and provide application-level abuse controls.
- Keep append-only agency correspondence and ISBN evidence auditability intact.
- Use encrypted backups on a separate failure domain and perform restore drills.
- Do not claim global CDN, anycast, enterprise DDoS scrubbing or Cloudflare-equivalent global resilience from a single node.

## Phased delivery

### Phase 0 — portability and design (no infrastructure spend)
1. Keep registry domain logic independent from Worker/D1 APIs.
2. Define a provider-neutral application contract and PostgreSQL schema/migration plan.
3. Document deployment, secrets, backup, restore, observability and security controls.
4. Add local development/test instructions that do not require a Cloudflare account.
5. Keep the existing Worker adapter labelled as transitional until replacement is verified.

### Phase 1 — private foundation
1. Select the first execution substrate and confirm available capacity.
2. Deploy private ingress, application runtime, PostgreSQL and monitoring.
3. Establish encrypted off-node backup and prove restoration.
4. Keep the service private; run security and operational acceptance tests.

### Phase 2 — registry migration
1. Implement the PostgreSQL repository adapter and migration set.
2. Migrate catalogue, publisher, author, edition, ISBN evidence, agency application and correspondence records.
3. Verify row counts, checksums, audit history and application behaviour.
4. Run parallel acceptance tests; cut over only after verified backup and rollback.
5. Retire the transitional provider adapter only after the self-owned deployment is proven.

### Phase 3 — owned DNS and public edge
1. Establish registrar control and delegation prerequisites.
2. Deploy redundant authoritative DNS nodes in separate failure domains and configure DNSSEC.
3. Add public ingress, TLS, WAF, rate limiting and cache.
4. Add additional regions only when funded capacity and operational support exist.
5. Test failover, abuse handling, certificate renewal and recovery.

## Cost and approval guardrails

- No paid hosting, domains, bandwidth commitments, hardware, or third-party subscriptions may be provisioned without explicit approval.
- Prefer software that can be self-hosted and audited; free/open-source software does not make compute, bandwidth, power, storage or operations free.
- Before selecting a hosting footprint, record expected monthly cost, resource requirements, data residency, backups and recovery objectives.
- No production deployment is implied by this ADR.

## Acceptance gates

The ISBN Registry is not production-ready on this architecture until: provider-neutral persistence is implemented; PostgreSQL migrations and data integrity tests pass; access controls are verified; encrypted backup and restore are demonstrated; monitoring and alerting are active; DNS/TLS/WAF controls pass tests; and an authorised operator signs off on the deployment and cost plan.
