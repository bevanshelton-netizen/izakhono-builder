# IZAKHONO HOST — Owned Runtime v1

## Decision

IZAKHONO HOST is now the production architecture target. Vercel is not a required runtime dependency and must not be treated as the source of truth.

**Owned-first. Externally reversible.**

## Planes

1. **Control plane** — customer, domain, site, billing, jobs and audit state.
2. **Edge plane** — IZAKHONO DNS, reverse proxy and TLS termination.
3. **Runtime plane** — isolated tenant/site runtimes on IZAKHONO nodes.
4. **Data plane** — PostgreSQL, object storage and Valkey.
5. **Mail plane** — Postfix/Dovecot/Rspamd-class services with DKIM/SPF/DMARC and deliverability gates.
6. **Provisioner** — typed jobs: domain → DNS → site → SSL → mail → payment reconciliation → acceptance.
7. **FORTRESS** — secrets, identity, audit, rate limits, backups and recovery controls.

## Current repository implementation

- Native Node control-plane runtime at `runtime/control-plane`.
- Container build for the native runtime.
- CoreDNS authoritative-DNS baseline.
- Caddy edge/TLS baseline.
- PostgreSQL, MinIO and Valkey service definitions.
- Existing HOST control-plane API and D1-compatible schema remain the application control plane while the physical node is activated.

## Promotion rule

A site is not called `live` until HTTPS, DNS and intended-content acceptance evidence all exist. A mail service is not called `live` until the full mail acceptance gate passes.

## Physical activation gate

The repository is build-complete for the owned runtime baseline, but production status still requires a Docker-capable IZAKHONO node, public network reachability, DNS delegation, TLS validation, backups and end-to-end acceptance testing.
