# IZAKHONO Hybrid Live Standard

**Effective:** 22 September 2026  
**Updated:** 26 September 2026  
**Policy:** owned-first, externally reversible, dual-path resilient

## Purpose

HYBRID LIVE is the operating mode used when a platform has an IZAKHONO-owned route and an approved external route that are both intentionally retained as part of the production architecture.

Before owned promotion, a verified external production route may remain the public traffic authority while the IZAKHONO-owned route is built, tested or promoted. After owned promotion, the IZAKHONO-owned route becomes primary, while the external route remains operational as verified resilience, recovery and approved service infrastructure.

HYBRID LIVE is not a fifth deployment status label. The evidence label remains one of the four portfolio-approved labels.

## Traffic authority

While HYBRID LIVE is active:

1. before owned promotion, the last verified external production route remains the public traffic authority;
2. IZAKHONO-owned NODE/EDGE is the promotion target and may receive local, canary or verification traffic;
3. after owned promotion, IZAKHONO-owned NODE/EDGE becomes the primary application route;
4. the approved external route remains operational as warm, independently reachable resilience and is not removed merely because the owned route passes;
5. data/auth/payment/CDN/edge services may remain on approved external infrastructure where migration is not separately verified or where external resilience is deliberately retained;
6. a failed owned-route gate must not interrupt the verified external route;
7. both paths must continue receiving health verification so failback evidence does not become stale;
8. traffic switching must not create split-brain writes, duplicate payment processing, duplicate webhooks or conflicting customer state.

## Steady-state after owned promotion

The intended steady state is **internal primary + external resilience**, not internal-only.

- **Internal:** NODE01 / IZAKHONO EDGE / IZAKHONO DNS is the primary application execution path once all owned gates pass.
- **External:** approved providers such as Vercel, Render, Cloudflare and Supabase remain usable for warm failover, public bridging, CDN/edge acceleration, backend/data/auth/storage, payment/webhook continuity and disaster recovery.
- External production routes must remain deployable and periodically verified.
- Stateful services use a single authoritative writer unless an application has an independently tested active-active data design.
- Automated failover is allowed only after the health trigger, state consistency, session behaviour, payment behaviour and failback procedure are proven. Until then, failover remains a guarded operational action.
- No provider becomes a permanent lock-in dependency: external integrations remain replaceable adapters and the authoritative source remains under IZAKHONO control.

## Promotion rule

A platform may move public traffic authority to its owned hostname only after:

- the real NODE target is healthy;
- EDGE configuration validates;
- DNS resolves to the intended public target;
- TCP 443 and HTTPS pass externally;
- the expected application health endpoint passes;
- certificates are valid;
- backup/restore evidence exists;
- external failback remains reachable;
- product-specific payment, legal and readiness gates pass.

Only then may the platform status become **OWNED LIVE VERIFIED**.

Promotion does not decommission the external route. It changes the primary traffic authority while preserving the external path as verified resilience.

## External resilience

Approved external infrastructure may perform one or more of these roles:

- current production front end;
- warm rollback/failback route;
- backend/data/auth/storage dependency;
- public bridge while owned ingress is unavailable;
- payment/webhook endpoint;
- CDN/Worker/edge acceleration;
- source mirror;
- disaster-recovery execution route.

The role must be recorded explicitly so an external dependency is not accidentally removed during an infrastructure migration.

## Wave 1

Allegro-Vibez and The Chancellor operate under HYBRID LIVE:

- Vercel carries the currently verified public application traffic until the owned public acceptance gates pass.
- Supabase WebStart provides approved active resilience/backend functions used across the portfolio, including command, Allegro and payment services.
- NODE01/IZAKHONO EDGE is the owned promotion target.
- The owned hostnames are `allegro.izakhonoafrica.co.za` and `chancellor.izakhonoafrica.co.za`.
- After successful owned promotion, NODE01/EDGE becomes primary and the verified Vercel routes remain operational as warm external resilience.
- The external production and rollback routes remain protected and continue to be health-checked after owned promotion.
