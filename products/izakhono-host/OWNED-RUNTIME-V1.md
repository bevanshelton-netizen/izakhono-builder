# IZAKHONO HOST — Owned Runtime v1

## Decision

IZAKHONO HOST is the production architecture target. The customer web runtime is owned by IZAKHONO and is not dependent on a third-party web-hosting platform.

**Owned-first. Externally reversible.**

## Planes

1. **Control plane** — customer, domain, site, billing, jobs and audit state.
2. **Edge plane** — IZAKHONO DNS, reverse proxy and TLS termination.
3. **Runtime plane** — isolated tenant/site runtimes across IZAKHONO nodes.
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
- Multi-node topology and role separation.
- Node preflight verification script.
- Runtime smoke test in CI.
- Runtime backup and controlled restore scripts.
- Existing HOST application control plane and provider adapters remain replaceable orchestration components.

## Cluster model

The platform is not constrained to one machine. Multiple owned nodes can carry CONTROL, EDGE, DNS, RUNTIME, DATA, MAIL, BACKUP and FORTRESS roles. See `CLUSTER-NODE-ROLES.md`.

## Promotion rule

A site is not called `live` until HTTPS, DNS and intended-content acceptance evidence all exist. A mail service is not called `live` until the full mail acceptance gate passes.

## Execution-environment activation gate

NODE01 is a logical software runtime identity. HOST must provision and manage its execution environment using existing, owner-controlled capacity that has first been inventoried and security-assessed. This does not require IZAKHONO to own or purchase physical server hardware. No host, VM, node capacity, public route or production runtime is treated as available until its actual binding and independent checks are recorded.

The remaining activation evidence is gathered against the approved execution environment: runtime activation, public IPv4/IPv6 reachability where configured, required network ports, DNS delegation, trusted HTTPS, backup/restore, FORTRESS controls and end-to-end customer QA. If suitable existing capacity has not yet been verified, execution remains blocked; do not create a paid resource or purchase hardware to bypass the gate.

No repository commit, topology declaration or CI result is treated as proof that an execution environment or public Internet path is live.
