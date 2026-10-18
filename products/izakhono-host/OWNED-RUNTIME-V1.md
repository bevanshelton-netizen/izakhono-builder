# IZAKHONO HOST — Owned Runtime v1

## Decision

IZAKHONO HOST is the production architecture target. The customer web runtime is owned by IZAKHONO and is not dependent on a third-party web-hosting platform.

**Owned-first. Externally reversible.**

## Planes

1. **Control plane** — customer, domain, site, billing, jobs and audit state.
2. **Edge plane** — IZAKHONO DNS, reverse proxy and TLS termination.
3. **Runtime plane** — isolated tenant/site runtimes on IZAKHONO nodes.
4. **Data plane** — PostgreSQL, object storage and Valkey.
5. **Mail plane** — Postfix/Dovecot/Rspamd-class services with DKIM/SPF/DMARC and deliverability gates.
6. **Provisioner** — typed jobs: domain → DNS → site → SSL → mail → payment reconciliation → acceptance.
7. **FORTRESS** — secrets, identity, audit, rate limits, backups and recovery controls.

## Software baseline completed

- Native Node control-plane runtime at `runtime/control-plane`.
- Persistent site state and per-domain public document roots.
- Hostname-based native site serving.
- Caddy edge with on-demand public TLS admission.
- CoreDNS authoritative-DNS baseline.
- PostgreSQL, MinIO and Valkey service definitions with health checks.
- One-command NODE01 bootstrap/activation path.
- Runtime smoke test in CI.
- Runtime backup and controlled restore scripts.
- Existing HOST application control plane and provider adapters remain replaceable orchestration components.

## Promotion rule

A site is not called `live` until HTTPS, DNS and intended-content acceptance evidence all exist. A mail service is not called `live` until the full mail acceptance gate passes.

## Physical activation gate

The software build is complete for this owned runtime baseline. The remaining production claim depends on physical evidence from NODE01: Docker execution, public IPv4/IPv6 reachability, TCP/UDP 53 where delegated, ports 80/443, public DNS delegation, trusted HTTPS, backup/restore, mail acceptance and end-to-end customer QA.

No repository commit is treated as proof that the physical node or public Internet path is live.
