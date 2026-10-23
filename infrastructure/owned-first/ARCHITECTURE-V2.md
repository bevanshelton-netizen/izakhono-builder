# IZAKHONO OWNED INFRASTRUCTURE V2

## Objective

Make IZAKHONO production-capable without depending on Vercel, Netlify, Hostinger or any other hosted application platform.

**OWNED-FIRST. EXTERNALLY REVERSIBLE. NO HOSTAGE PLATFORM.**

## Authority

GitHub is the source repository and change-control mirror. The IZAKHONO control plane is the operational source of truth for provisioned resources. Owned nodes are the production runtime authority.

## Planes

1. **CONTROL** — provisioning jobs, customer/domain/site state, releases and audit.
2. **EDGE** — Caddy ingress, TLS and tenant routing.
3. **DNS** — CoreDNS authoritative service with independent secondary capacity.
4. **RUNTIME** — isolated application/site containers and static sites.
5. **DATA** — PostgreSQL, MinIO/S3-compatible object storage and Valkey.
6. **MAIL** — Docker Mailserver/Rspamd-class mail runtime with SPF, DKIM, DMARC, TLS and acceptance tests.
7. **BACKUP** — independent encrypted backups plus restore verification.
8. **FORTRESS** — identity, secrets, policy, audit and fail-closed controls.
9. **PROVISIONER** — typed, idempotent workflow: customer → domain → DNS → site → TLS → mail → payments → acceptance.

## Minimum production cluster

- NODE01: CONTROL + EDGE + RUNTIME
- NODE02: EDGE + RUNTIME + DNS secondary
- NODE03: EDGE + RUNTIME + BACKUP + DNS secondary
- Dedicated DATA, MAIL and FORTRESS nodes may be introduced without changing customer contracts.

A single node is a bootstrap configuration, not the desired steady state.

## Public traffic

Internet → authoritative DNS → healthy owned EDGE → tenant router → owned runtime.

Data stores and control-plane administration remain private. No database, queue or internal API is directly exposed to the public Internet.

## Provider policy

External providers can supply reversible capacity such as a registrar, upstream DNS secondary, emergency compute or payment/acquiring services. They must not become the only production runtime, source of truth or recovery path.

## Production gate

A workload may only be marked LIVE after independent evidence exists for:

- DNS resolution
- HTTPS/TLS
- intended application response
- health/readiness
- authentication where applicable
- persistence
- backup
- restore
- failover where required
- security controls

CI success alone is never production evidence.
