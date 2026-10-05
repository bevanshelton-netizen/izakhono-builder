# IZAKHONO Control Plane

## Mission

Create an owned-first infrastructure control plane that removes avoidable vendor and infrastructure bottlenecks from IZAKHONO builds.

The Control Plane does not attempt to reinvent Internet standards. It automates, orchestrates, validates, and provides reversible fallbacks around them.

## Core workflow

`ORDER/PAYMENT -> PROVISION -> DNS -> NETWORK -> TLS -> APP -> DATA -> EMAIL -> OBSERVABILITY -> BACKUP -> BILLING -> HANDOVER`

## Modules

- `dns`: authoritative DNS management, zone lifecycle, health checks, DNSSEC readiness
- `network`: IP inventory, NAT/CGNAT detection, port reachability and service exposure checks
- `edge`: reverse proxy, routing, certificates and health-based failover
- `hosting`: application/container provisioning and deployment manifests
- `email`: domain/mailbox provisioning, SPF/DKIM/DMARC/MX checks
- `data`: PostgreSQL and object-storage provisioning with backup policies
- `identity`: tenants, users, roles, API keys and audit logs
- `observability`: uptime, DNS, TLS, HTTP, container and dependency checks
- `backup`: scheduled encrypted backups and restore verification
- `billing`: payment confirmation -> provisioning entitlement
- `provisioner`: one API/workflow that composes all modules
- `diagnostics`: automatic root-cause reports instead of manual troubleshooting
- `fallback`: provider-neutral adapters so external services remain available when owned infrastructure is unavailable

## Non-negotiable rules

1. Owned-first: prefer IZAKHONO-controlled infrastructure where practical.
2. Standards-first: use DNS, TLS, SMTP, HTTP, PostgreSQL, S3-compatible APIs and other established protocols rather than proprietary replacements.
3. Externally reversible: every external dependency must have an adapter and exit path where feasible.
4. Fail closed: never report a service as live unless a health check proves it.
5. No single point of failure: critical services require secondary/fallback paths before production.
6. Secrets never live in source control.
7. Every provisioning action is idempotent and auditable.
8. Every production change has a rollback path.

## Priority order

### P0 - unblock builds
DNS, public reachability, reverse proxy, TLS, deployment, health checks, backups, secrets.

### P1 - remove operational friction
Email, identity, storage, databases, CI/CD, monitoring, billing-to-provisioning.

### P2 - replace SaaS dependencies where economically justified
Git, analytics, collaboration, support/helpdesk, automation, customer portals.

### P3 - proprietary IZAKHONO products
NAV infrastructure, I-CONNECT platform services, fleet/security services and the customer-facing IZAKHONO Cloud portal.

## Reality check

Some dependencies cannot be replaced purely in software. Domain registration, upstream Internet transit, public IP allocation, electricity, physical server connectivity, certificate trust anchors and statutory/registry delegation remain external dependencies. The Control Plane must therefore detect and route around these dependencies, not pretend they do not exist.
