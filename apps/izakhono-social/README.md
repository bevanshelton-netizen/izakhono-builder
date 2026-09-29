# IZAKHONO SOCIAL

**Status:** NOT YET PUBLIC  
**Release:** 0.1.0 / `izakhono-social-2026-09-29-mvp1`  
**Owned target:** IZAKHONO Runtime Fabric  
**External resilience backend:** IZAKHONO WebStart `connecta-external`  
**Planned owned hostname:** `social.izakhonoafrica.co.za` (not claimed live)

## Product

IZAKHONO SOCIAL is an IZAKHONO-owned public conversation network. The MVP supports:

- account creation and sign-in;
- public feeds and a following feed;
- original posts and replies;
- reposts;
- likes/appreciations;
- private bookmarks;
- public profiles and follows;
- communities;
- notifications;
- direct conversations and messages;
- server-side moderation and rate limiting;
- responsive desktop/mobile UI.

The backend deliberately reuses the existing `connecta_*` data family so the portfolio has one social relationship graph instead of two competing stores.

## Architecture

`browser → IZAKHONO SOCIAL app → server-mediated social API → connecta_* tables`

The current backend adapter is the active WebStart Edge Function `connecta-external`. The new `social-*` actions are additive and preserve all legacy CONNECTA actions.

The browser receives no database service credential. CONNECTA/social tables use RLS and the new tables have direct `anon` / `authenticated` table grants revoked. Stateful data remains outside the static release artifact.

## Runtime

The app is a portable static release packaged with nginx. It exposes:

- `/healthz`
- `/release.json`

It is suitable for the IZAKHONO Runtime Fabric and an approved external resilience target without rebuilding the application.

## Public launch gates

Do not change the status to OWNED LIVE VERIFIED until all applicable gates pass:

1. build/release identity approved;
2. container/local health passes;
3. account registration/login and authenticated API flows pass;
4. data backup/restore evidence exists;
5. public DNS/TCP 443/HTTPS/TLS pass on the owned route;
6. rollback/failback is verified;
7. Terms, Privacy, Community/Safety rules and POPIA-facing notices are linked from the UI;
8. media upload controls, abuse reporting/appeal workflows and moderation operations are production-ready;
9. no placeholder metrics or fabricated user activity is displayed.

## Commercial direction

The Business Centre is intentionally gated. Advertising, promoted posts, payments and lead routing should only be enabled once billing reconciliation, ad disclosure, privacy and platform rules are approved.
