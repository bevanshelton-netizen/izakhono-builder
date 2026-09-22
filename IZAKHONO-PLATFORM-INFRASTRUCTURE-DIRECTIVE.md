# IZAKHONO Platform Infrastructure Directive

**Status:** Portfolio-wide operating directive  
**Issued:** 22 September 2026  
**Operator:** IZAKHONO AFRICA (PTY) LTD  
**Policy:** Owned-first, externally reversible

## Decision

Every IZAKHONO platform will target IZAKHONO-owned infrastructure as its primary technical home. Verified external infrastructure may remain in service, or be restored immediately, whenever it is needed for public availability, revenue continuity, distribution, resilience or recovery.

No platform will be taken offline merely to demonstrate infrastructure ownership. A platform moves to the owned public route only after that route is proven healthy.

## Authoritative architecture

The intended owned path is:

`ISN-01 / NODE01 → CODE / Forge → Data, Auth, Storage, Queue and Analytics → Runtime → FORTRESS → EDGE / TLS → IZAKHONO DNS`

- NODE01 is the primary authority.
- NODE02–NODE04 are reserved for backup, recovery and future scaling.
- Forge and IZAKHONO Code hold the authoritative source and package history.
- FORTRESS controls security policy, secrets boundaries, health checks and audit evidence.
- EDGE terminates public HTTPS and routes traffic only to healthy services.
- Backups, restore tests and rollback instructions are mandatory before public cutover.

## External infrastructure rule

Vercel, Cloudflare, GitHub Pages, Cloudflare Tunnel, Tailscale Funnel, a controlled VPS gateway, and other approved providers may be used as public bridges or fallbacks.

External infrastructure is:

- permitted for immediate launch and revenue continuity;
- retained until the owned route passes all public verification gates;
- replaceable without changing the product's authoritative source or ownership;
- suitable for failover when NODE01, EDGE, DNS or TLS is unavailable;
- not the portfolio's ultimate source of truth.

Supabase may remain in use for data, authentication, storage or resilience where already approved. Its replacement or migration requires a separate, tested data plan; hosting migration alone does not authorize a database cutover.

## Public cutover gates

An owned deployment may be called **OWNED LIVE VERIFIED** only when all of the following pass:

1. Application and dependency health checks pass on the real target machine.
2. The public domain returns the expected application over HTTPS.
3. DNS, certificates and EDGE routing are valid and monitored.
4. Backup creation and a restore test succeed.
5. A tested rollback or external failback route exists.
6. Secrets, customer data and administrative interfaces remain protected.
7. Product content, legal pages, claims and payment boundaries are approved.

Until then, the last verified external production route remains active.

## Status language

Every platform must use one of these evidence-based labels:

| Label | Meaning |
|---|---|
| **BUILT / VERIFIED LOCALLY** | Package and local tests pass; no public availability claim. |
| **EXTERNAL LIVE VERIFIED** | A named external URL has passed a current public check. |
| **OWNED LIVE VERIFIED** | IZAKHONO DNS, HTTPS, EDGE and application health have passed the cutover gates. |
| **NOT YET PUBLIC** | No currently verified public route exists. |

The words “live,” “launched,” or “deployed” must not be used without the matching evidence.

## Commercial and payment continuity

- iKhokha is the preferred South African payment route where the specific product, links, reconciliation process and legal pages are ready.
- Existing verified payment and lead-intake routes remain active until their replacements pass end-to-end testing.
- A hosting change must never silently change pricing, billing, customer records or settlement instructions.
- Public fallback may be activated immediately to protect sales and customer access.

## Platforms covered

This directive applies to the full IZAKHONO portfolio, including:

- KORA, KORA Cinema, KORA Gospel TV and KORA Kids
- Allegro-Vibez and Allegro Radio
- Edu-Build and ECD360
- FAISReady and DOXA-SURE
- AUTO AI and Learner Driver SA
- WorkNow, Memory Mania, Music School and Recording Studio
- CROWNÉ by Netty
- ZEELY-style platform, Business Websites / Supercool and The Chancellor
- FORTRESS, IZAKHONO Code, IZAKHONO Work, IZAKHONO Cloud and IZAKHONO Send
- every future IZAKHONO product unless a signed product-specific exception supersedes this directive

## Required platform inheritance

Each platform repository, package or deployment record must carry:

- the operator name and applicable trading name;
- its authoritative source location and approved commit/version;
- its owned target and currently verified public route;
- its external fallback route;
- its data, authentication and payment dependencies;
- health, backup, restore and rollback evidence;
- one of the approved status labels above.

If a platform cannot prove its owned public route, it must continue using or revert to its last verified external route while the owned path is repaired.

## Current evidence position

The available IZAKHONO build records show a substantial sovereign stack with local validation, Forge import and mirroring, runtime packaging, health gates, backup/restore controls and platform launchers. They do **not**, by themselves, prove that NODE01 is presently reachable through public IZAKHONO DNS and HTTPS.

Therefore the current portfolio position is:

- IZAKHONO-owned infrastructure is the primary destination.
- External infrastructure is an approved and reversible production bridge.
- No existing verified external service is removed before owned public verification.
- NODE01 public status remains unclaimed until a fresh machine-side and public-side verification report passes.

## Immediate execution order

1. Run the NODE01 guardian and health report on the owner machine.
2. Verify EDGE reachability, public DNS and TLS from outside the IZAKHONO network.
3. Record the current production and fallback URL for every platform.
4. Preserve verified external routes while migrating one platform at a time.
5. Promote only successful routes to **OWNED LIVE VERIFIED**.
6. Fail back externally whenever an owned-route gate fails.

This directive is effective immediately.
