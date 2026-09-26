# IZAKHONO Platform Infrastructure Directive

**Status:** Portfolio-wide operating directive
**Issued:** 22 September 2026
**Amended:** 26 September 2026
**Operator:** IZAKHONO AFRICA (PTY) LTD
**Policy:** Owned-first, node-agnostic, externally reversible

## Decision

Every IZAKHONO platform targets IZAKHONO-owned infrastructure as its preferred technical home, but **no individual machine is allowed to become a launch gate**.

The authoritative unit is the approved source plus immutable release artifact. NODE01, NODE02, NODE03, NODE04 and approved external resilience hosts are execution targets. The same release must be able to move between them without rebuilding.

Verified external infrastructure may remain in service, or be restored immediately, whenever needed for public availability, revenue continuity, distribution, resilience or recovery.

No platform will be taken offline merely to demonstrate infrastructure ownership.

## Authoritative architecture

The operating path is:

`CODE / Forge → signed immutable release → IZAKHONO Runtime Fabric → FORTRESS → EDGE / TLS → IZAKHONO DNS`

The Runtime Fabric may contain:

- NODE01 and any other healthy IZAKHONO-owned runtime;
- the four-node k3s cluster when its physical members are installed and verified;
- approved external resilience runtimes.

**No runtime node is the source of truth.**

- NODE01 may be a preferred owned host, but is not the primary authority.
- NODE02–NODE04 are peers/secondary capacity, not dormant machines that must wait for NODE01.
- Forge and IZAKHONO Code hold authoritative source and package history.
- FORTRESS controls security policy, secrets boundaries, health checks and audit evidence.
- EDGE terminates public HTTPS and routes traffic only to healthy, approved release identities.
- Backups, restore tests and rollback instructions remain mandatory.

See `infra/runtime-fabric/README.md`.

## Node failure rule

A NODE01 failure must be treated as **one failed runtime**, not as a portfolio-wide blocker.

If NODE01 is unhealthy:

1. EDGE removes it from traffic.
2. Operations test the next owned runtime.
3. If no owned runtime is healthy, the approved external resilience route carries traffic.
4. NODE01 is repaired independently.
5. It receives traffic again only after fresh health and release-identity verification.

The same rule applies to every node.

## External infrastructure rule

Vercel, Cloudflare, GitHub Pages, Cloudflare Tunnel, Tailscale Funnel, a controlled VPS gateway, and other approved providers may be used as public bridges or fallbacks where technically suitable.

External infrastructure is:

- permitted for immediate launch and revenue continuity;
- retained until owned capacity passes public verification;
- replaceable without changing the product's authoritative source or ownership;
- suitable for failover when any owned node, EDGE, DNS or TLS path is unavailable;
- not the portfolio's source of truth.

Supabase may remain in use for data, authentication, storage or resilience where separately approved. Hosting migration alone does not authorize a database cutover.

## Hybrid live operating mode

When a verified external production route is carrying users while owned capacity is still being proven, the platform operates in **HYBRID LIVE** mode.

An owned-runtime failure must fail over or fail back without taking the verified external route offline. See `infra/public-cutover/HYBRID-LIVE-STANDARD.md`.

## Public cutover gates

An owned deployment may be called **OWNED LIVE VERIFIED** when at least one owned runtime serving the approved release passes:

1. Application and dependency health checks on the real target.
2. Public domain returns the expected application over HTTPS.
3. DNS, certificates and EDGE routing are valid and monitored.
4. Backup creation and restore evidence required by the product pass.
5. A tested rollback or failover route exists.
6. Secrets, customer data and administrative interfaces remain protected.
7. Product content, legal pages, claims and payment boundaries are approved.

Completion of the four-node cluster is **not** a prerequisite for an individual product to be publicly available.

## Status language

| Label | Meaning |
|---|---|
| **BUILT / VERIFIED LOCALLY** | Package and local tests pass; no public availability claim. |
| **EXTERNAL LIVE VERIFIED** | A named external URL has passed a current public check. |
| **OWNED LIVE VERIFIED** | At least one IZAKHONO-owned runtime plus DNS/HTTPS/EDGE/application health has passed the gates. |
| **FABRIC LIVE VERIFIED** | Two or more independent approved runtimes have passed and EDGE failover has been tested. |
| **NOT YET PUBLIC** | No currently verified public route exists. |

The words “live,” “launched,” or “deployed” must not be used without matching evidence.

## Commercial and payment continuity

- iKhokha is the preferred South African payment route where the specific product, links, reconciliation process and legal pages are ready.
- Existing verified payment and lead-intake routes remain active until replacements pass end-to-end testing.
- A hosting change must never silently change pricing, billing, customer records or settlement instructions.
- Public fallback may be activated immediately to protect sales and customer access.

## Required platform inheritance

Each platform repository, package or deployment record must carry:

- operator name and applicable trading name;
- authoritative source and approved release/version;
- configured runtime targets;
- currently verified public route;
- external fallback route;
- data, authentication and payment dependencies;
- health, backup, restore and rollback evidence;
- approved status label.

Applications must not hard-code NODE01 as their only runtime endpoint.

## Relationship to the node cluster

`infra/node-cluster` remains the long-term owner-controlled HA design. Its control-plane quorum and four-node proof apply to the cluster itself. They must not be interpreted as a requirement to hold every product offline until all four physical nodes exist.

The immediate operating layer is the node-agnostic Runtime Fabric.

## Immediate execution order

1. Package each platform as an immutable, portable release.
2. Register every available owned and external runtime target.
3. Verify each target independently through its health endpoint.
4. Configure EDGE to route only to healthy approved releases.
5. Keep external resilience active whenever owned capacity is unavailable.
6. Add NODE02–NODE04 as capacity when real machines are available.
7. Test failure of every runtime—including NODE01—without interrupting a replicated/stateless service.
8. Promote to **FABRIC LIVE VERIFIED** only after real failover evidence passes.

This directive is effective immediately.
