# IZAKHONO Hybrid Live Standard

**Effective:** 22 September 2026  
**Policy:** owned-first, externally reversible

## Purpose

HYBRID LIVE is the operating mode used when a platform already has a verified external production route while its IZAKHONO-owned route is being built, tested or promoted.

HYBRID LIVE is not a fifth deployment status label. The evidence label remains one of the four portfolio-approved labels. For a platform still serving users through a verified external route, that label remains **EXTERNAL LIVE VERIFIED** until the owned public cutover gates pass.

## Traffic authority

While HYBRID LIVE is active:

1. the last verified external production route remains the public traffic authority;
2. IZAKHONO-owned NODE/EDGE is the promotion target and may receive local, canary or verification traffic;
3. data/auth/payment services may remain on approved external infrastructure where migration is not separately verified;
4. a failed owned-route gate must not interrupt the verified external public route;
5. external fallbacks remain preserved after owned promotion until rollback evidence is tested and retained.

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

## External resilience

Approved external infrastructure may perform one or more of these roles:

- current production front end;
- rollback/failback route;
- backend/data/auth/storage dependency;
- public bridge while owned ingress is unavailable;
- payment/webhook endpoint;
- CDN/Worker/edge acceleration;
- source mirror.

The role must be recorded explicitly so an external dependency is not accidentally removed during an infrastructure migration.

## Wave 1

Allegro-Vibez and The Chancellor are currently operated in HYBRID LIVE mode:

- Vercel carries the verified public application traffic.
- Supabase WebStart provides approved active resilience/backend functions used across the portfolio, including command, Allegro and payment services.
- NODE01/IZAKHONO EDGE is the owned promotion target.
- The owned hostnames are `allegro.izakhonoafrica.co.za` and `chancellor.izakhonoafrica.co.za`.
- The external production and rollback routes remain protected until the owned public acceptance reports pass.
