# CONNECTA

A privacy-first, safety-led social network operated by IZAKHONO AFRICA (PTY) LTD.

## Product promise

- People, not profiling.
- No behavioural tracking, advertising IDs or silent analytics.
- User-controlled feed modes.
- Zero-tolerance safety controls for cyberbullying, threats, doxxing, account cloning and prohibited harmful conduct.
- Content provenance: attributed shares, exact-copy alerts and high-confidence altered-image review alerts.
- Evidence-backed business verification; verified badges cannot simply be purchased.
- Owned-first, externally reversible infrastructure.

## Current product

CONNECTA now has a real sovereign application path rather than a seeded demo feed:

- local account registration and login on CONNECTA ENGINE;
- HTTP-only web session proxy — engine session tokens are not returned to browser JavaScript;
- PostgreSQL-backed profiles, posts, comments, reactions, follows, connections and communities;
- real feed modes: Balanced, Latest, Following and Communities;
- real community creation/discovery/joining;
- founder invite creation and invite-link redemption;
- first-party notification centre;
- content sharing with original-owner attribution/alerts;
- exact and perceptual picture-copy protection;
- report intake, protective locks, enforcement notices and appeals;
- business verification workflow;
- full-stack health endpoint that fails unless web + engine + database are healthy.

## Infrastructure

Primary owned route:

`IZAKHONO CODE -> NODE01 -> PostgreSQL + CONNECTA ENGINE + CONNECTA Web -> EDGE/TLS -> IZAKHONO DNS`

External hosting is a reversible resilience route only. The Next.js web tier can point at any approved CONNECTA ENGINE endpoint through the server-only `CONNECTA_ENGINE_URL` variable without rebuilding the UI.

See:
- `docs/CONNECTA-HYBRID-DEPLOYMENT.md`
- `docs/CONNECTA-ZERO-TOLERANCE-SAFETY.md`

## NODE01

Prepare `/etc/izakhono/apps/connecta.env` from `.env.example`, then run:

`RUN-CONNECTA-NODE01.cmd`

The launcher performs local owned proof only. It does not change public DNS.

## Health

`GET /health`

HTTP 200 means the Next.js web tier reached a healthy CONNECTA ENGINE whose PostgreSQL database also passed. A rendering-only web server cannot pass this gate.

## Current evidence status

**NOT YET PUBLIC**

The application/package can be tested in CI and on NODE01, but public LIVE status requires an independently verified HTTPS route, DNS/TLS evidence, backup/restore proof and rollback/failback proof.

## Remaining public-launch gates

1. Merge a green public-readiness build.
2. Execute the immutable NODE01 package on the actual owner machine.
3. Produce backup + restore evidence for PostgreSQL and media storage.
4. Stage EDGE/TLS and the chosen CONNECTA hostname.
5. Verify public HTTPS 200 on `/health` and the real registration/feed experience from outside the IZAKHONO network.
6. Configure and independently verify an external resilience route without replacing the owned authority.
7. Only then change the evidence label to **OWNED LIVE VERIFIED** or **EXTERNAL LIVE VERIFIED**.
