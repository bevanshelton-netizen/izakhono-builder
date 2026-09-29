# CONNECTA by IZAKHONO

An African-built, privacy-first public conversation network operated by IZAKHONO AFRICA (PTY) LTD.

## Product promise

- People, not profiling.
- No behavioural tracking, advertising IDs or silent analytics.
- User-controlled feed modes instead of one opaque ranking system.
- Zero-tolerance safety controls for cyberbullying, threats, doxxing, account cloning and prohibited harmful conduct.
- Content provenance: attributed reposts/shares, exact-copy alerts and high-confidence altered-image review alerts.
- Evidence-backed business verification; verified badges cannot simply be purchased.
- Owned-first, externally reversible infrastructure.

## Current product

CONNECTA now combines an X/Twitter-class public-conversation experience with its existing sovereign backend:

- secure local registration/login with HTTP-only browser sessions;
- three-column desktop experience plus responsive mobile navigation and composer;
- PostgreSQL-backed public profiles with editable bio, location and website;
- feed modes: For You/Balanced, Following, Latest and Communities;
- posts, threaded replies, reversible reactions, reposts and private bookmarks;
- public search across profiles and posts;
- real hashtag trends calculated from allowed public posts in the last seven days;
- who-to-follow suggestions ordered by public follower count and recency without behavioural profiles;
- reversible follows and follower/following counts;
- private direct conversations and messages with block and moderation protections;
- community creation, discovery and joining;
- founder invite creation and invite-link redemption;
- first-party notifications for follows, replies, reactions, messages, safety and content-owner alerts;
- content sharing/reposting with original-owner attribution;
- exact and perceptual picture-copy protection;
- report intake, protective locks, enforcement notices and appeals;
- evidence-backed business verification;
- full-stack health endpoint that fails unless web + engine + PostgreSQL are healthy.

Bookmarks, trends, suggestions and social-graph actions are product features only. CONNECTA does not repurpose them into hidden behavioural-advertising profiles.

## Architecture

Primary owned route:

`IZAKHONO CODE -> NODE01 -> PostgreSQL + CONNECTA ENGINE + CONNECTA Web -> FORTRESS -> EDGE/TLS -> IZAKHONO DNS`

The web tier proxies browser calls to CONNECTA ENGINE server-side. Engine session tokens remain in secure HTTP-only cookies and are not returned to browser JavaScript.

External hosting is a reversible resilience route only. The Next.js web tier can point at any approved CONNECTA ENGINE endpoint through the server-only `CONNECTA_ENGINE_URL` variable without rebuilding the interface.

The September 2026 Supabase CONNECTA compatibility bridge remains an external resilience adapter; it is not the production authority for this sovereign product.

See:
- `docs/CONNECTA-HYBRID-DEPLOYMENT.md`
- `docs/CONNECTA-ZERO-TOLERANCE-SAFETY.md`

## NODE01

Prepare `/etc/izakhono/apps/connecta.env` from `.env.example`, then run:

`RUN-CONNECTA-NODE01.cmd`

The launcher performs local owned proof only. It does not change public DNS.

## Verification

`GET /health`

HTTP 200 means the Next.js web tier reached a healthy CONNECTA ENGINE whose PostgreSQL database and configured storage also passed. A rendering-only web server cannot pass this gate.

The CI workflow also typechecks/builds the web app, syntax-checks/tests the engine, builds owned and portable containers, boots complete stacks, verifies schema migrations, exercises the web-to-engine session proxy, and proves backup/restore plus growth, safety, content-provenance, business-verification and media-protection workflows.

## Current evidence status

**NOT YET PUBLIC**

The application/package may be called **BUILT / VERIFIED LOCALLY** only after the current branch/PR completes full CI successfully. Public LIVE status still requires independently verified HTTPS, DNS/TLS, backup/restore and rollback/failback evidence for the intended release.

## Remaining public-launch gates

1. Merge a green public-readiness build.
2. Execute the immutable release on the actual IZAKHONO owned runtime/NODE01 path.
3. Retain backup + restore evidence for PostgreSQL and media storage.
4. Stage FORTRESS, EDGE/TLS and the chosen CONNECTA hostname.
5. Verify public HTTPS 200 on `/health` and the real registration/feed/message experience from outside the IZAKHONO network.
6. Verify rollback/failback and an external resilience route without replacing the owned authority.
7. Only then change the evidence label to **OWNED LIVE VERIFIED** or **EXTERNAL LIVE VERIFIED**.
