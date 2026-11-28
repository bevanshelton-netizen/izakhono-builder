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

## Software baseline

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
- Optional KORA Next.js application workload at `docker-compose.kora.yml`, routed by Caddy to the native KORA container. It is opt-in and separate from the HOST control-plane service.

## KORA workload

See [KORA-OWNED-RUNTIME.md](./KORA-OWNED-RUNTIME.md) for the pinned source revision, build-time public configuration, FORTRESS-sourced runtime secrets, Caddy routing, health checks and owner-authorized activation sequence.

KORA's web process is hosted on the owned runtime. Supabase, Cloudflare Stream and PayFast remain external application dependencies until their respective IZAKHONO-native replacements are separately implemented and accepted; hosting the web process on owned nodes does not silently replace those services.

## Cluster model

The platform is not constrained to one machine. Multiple owned nodes can carry CONTROL, EDGE, DNS, RUNTIME, DATA, MAIL, BACKUP and FORTRESS roles. See `CLUSTER-NODE-ROLES.md`.

## Promotion rule

A site is not called `live` until HTTPS, DNS and intended-content acceptance evidence all exist. A mail service is not called `live` until the full mail acceptance gate passes. A KORA container health check proves process liveness only; KORA's strict `/api/readiness` and full production acceptance remain separate gates.

## Physical activation gate

The remaining work is execution and evidence on the owned nodes: Docker/runtime activation, public IPv4/IPv6 reachability, TCP/UDP 53 where delegated, ports 80/443, public DNS delegation, trusted HTTPS, backup/restore, FORTRESS controls and end-to-end customer QA.

No repository commit is treated as proof that a physical node or public Internet path is live.
