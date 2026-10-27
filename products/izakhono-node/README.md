# IZAKHONO NODE™ v1

**Owner-controlled compute and deployment runtime for the IZAKHONO ecosystem.**

IZAKHONO NODE is not a GitHub runner and it is not a wrapper around Vercel, Railway or another hosting vendor. It is the software runtime that turns hardware controlled by IZAKHONO into authenticated deployment and service-execution capacity across the IZAKHONO-owned node cluster.

## Core architecture

```text
IZAKHONO CODE
     │
     │ owner-controlled Git source
     ▼
IZAKHONO CONTROL
     │
     │ HMAC-signed deployment job
     ▼
IZAKHONO-OWNED NODE CLUSTER
     │
     ├── immutable source checkout
     ├── Docker build
     ├── canary health gate
     ├── promote / rollback
     ├── Compose service stacks
     ├── deployment evidence
     ├── failover / resilience
     └── cluster scheduling
     │
     ▼
IZAKHONO EDGE / TLS

Individual nodes are placement targets, not the production architecture.
```

## Node placement

The owned cluster may contain multiple owner-controlled nodes. Individual node selection is an operational placement, failover and resilience decision. No single node or workstation is the canonical production dependency.

Default node-local services are loopback-bound unless explicitly exposed through the reviewed IZAKHONO EDGE/TLS path:

- IZAKHONO NODE: `http://127.0.0.1:9191`
- IZAKHONO CONTROL: `http://127.0.0.1:9292`
- IZAKHONO CODE repositories: `/var/lib/izakhono-code/repos/*.git`

Public application traffic must go through the reviewed IZAKHONO EDGE/TLS path. NODE management ports are not public application endpoints.

## Sovereignty rules

1. **IZAKHONO CODE is the preferred source.** Jobs using `source=izakhono-code` resolve to owner-controlled repositories.
2. **GitHub is a temporary mirror only.** It remains available as an external fallback during migration and can later be disabled.
3. **Production means immutable.** Production deployment jobs require a full 40-character commit SHA.
4. **The node accepts signed commands only.** CONTROL signs requests with HMAC-SHA256, timestamp and one-time nonce.
5. **Jobs are idempotent.** Replayed deployment requests do not create duplicate production work.
6. **Health before promotion.** Services must pass their local health gates before promotion.
7. **Rollback is automatic where possible.** Failed production health/public acceptance restores the previous revision where one exists.
8. **Evidence is local and signed.** Completed jobs write owner-node evidence with job/output digests and an HMAC proof. Secrets are never written into proof files.

## Supported workload modes

### Single service

For applications with one Dockerfile and one application port.

### Compose service

For multi-process services. Environment files remain outside Git under `/etc/izakhono/apps/`.

## Cluster path

The `infra/node-cluster/` software supports the IZAKHONO-owned cluster with multiple owner-controlled machines, encrypted secrets, WireGuard-native networking, replicated IZAKHONO DATA and tested backup/restore procedures.

A cluster is only called production-ready after actual hardware/runtime evidence, failover, restore, security and external-edge tests pass. CI, repository declarations and topology files do not substitute for physical/runtime evidence.

## What this replaces

IZAKHONO NODE is the long-term replacement for using a third-party CI runner as the production execution mechanism.

Third-party source mirrors may remain available as reversible fallbacks, but the target flow is:

**IZAKHONO CODE → IZAKHONO CONTROL → IZAKHONO-OWNED NODE CLUSTER → IZAKHONO EDGE**

## Readiness boundary

CI can prove software rules, syntax and security invariants. It cannot by itself prove the physical nodes, Docker runtime, disks, network, public TLS route, failover or power resilience. Those require actual owned-node runtime evidence and the production promotion gates.

No application becomes **OWNED LIVE VERIFIED** merely because software CI passes.

## Public cutover

Owned-route migration waves must deploy the exact reviewed immutable production commits through IZAKHONO CONTROL, prove local health, then pass the reviewed EDGE/TLS, DNS and external HTTPS acceptance gates.

Wave rules:

- IZAKHONO CODE is attempted first.
- External source mirrors are permitted only as documented fallbacks.
- Build, runtime or health failures do not trigger an unrelated mirror retry.
- Existing external production routes remain active until owned-route acceptance passes.
- DNS/TLS/public traffic changes require the applicable production evidence gates.
- No platform becomes **OWNED LIVE VERIFIED** merely because a local rehearsal passes.
