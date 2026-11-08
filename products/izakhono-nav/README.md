# IZAKHONO NAV

**Product:** IZAKHONO NAV  
**Operator:** IZAKHONO AFRICA (PTY) LTD  
**Current package:** v1.0  
**Status:** SOURCE UPDATED / CI AND OWNED-RUNTIME VERIFICATION PENDING  
**Runtime policy:** IZAKHONO Runtime Fabric — no single node is a launch gate

## Completion acceptance

The authoritative capability matrix, release blockers and production acceptance checklist are maintained in [`COMPLETION-GATES.md`](./COMPLETION-GATES.md). Do not mark the product live until those gates pass.

## Product boundary

IZAKHONO NAV is the portfolio's privacy-first multilingual voice navigation platform.

The application is packaged to run unchanged across approved Runtime Fabric targets. NODE01 is not required. Any healthy approved runtime may serve the same release, and EDGE may fail over between targets after health and release identity checks.

## v0.8 runtime behavior

- configurable runtime targets outside application logic;
- health probing of all enabled NAV gateways;
- highest-priority healthy target selection;
- forced re-probe and retry after an owned runtime request fails;
- runtime ID, runtime class and release ID in gateway health;
- visible serving-runtime state in the NAV UI;
- same immutable application build across owned and external resilience targets.

## Release evidence

The previously recorded v1.0 artifact hash belongs to an earlier build and is not asserted as the hash of the current source. The current source changes require a fresh CI run, owned-runtime activation, and public endpoint verification before a release hash or live status is issued.

## Public status

No public-live claim is made by this record. A route becomes EXTERNAL LIVE VERIFIED, OWNED LIVE VERIFIED or FABRIC LIVE VERIFIED only after current public HTTPS and health evidence passes the portfolio directive.

## Next production gate

1. Place the same v0.7 release on at least one reachable Runtime Fabric target.
2. Configure real routing/search/tile services or an approved resilience route.
3. Verify public HTTPS.
4. Add a second independent target.
5. Stop the preferred target during a controlled test and verify uninterrupted failover.


## v0.8 public resilience deployment evidence

The NAV resilience shell and edge route were merged through PR #237. Builder CI and OpenAI Independence CI passed.

The production Cloudflare deployment was attempted by workflow run 36231538995 but stopped before deployment because the production environment has no `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID`. The controlled deploy run 36231539007 also skipped all deployment steps for the same reason.

Therefore `https://ai.izakhono.co.za/nav/` is a candidate route only and is **not** recorded as public-live.


## IZAKHONO NAV ENGINE v1.0

NAV now has its own independently deployable engine under `products/izakhono-nav/engine`.

The engine exposes runtime identity, health, routing, search and tile boundaries. It can run unchanged on any approved IZAKHONO Runtime Fabric target and does not require NODE01.

It deliberately fails closed: without an approved routing/search backend it returns 503 instead of fabricating navigation results. External resilience adapters are opt-in only.


## IZAKHONO NAV v1.0 — owned end-state

The v1 owned stack lives under `products/izakhono-nav/stack` and combines NAV's own engine with Valhalla routing, Nominatim search, locally generated South Africa PMTiles, Martin raster rendering and Caddy edge/TLS.

The web client and engine compatibility contracts are aligned. The stack is node-agnostic, external-host-independent by default, privacy-preserving, and includes first-run activation, OSM checksum verification, restart policies, an optional scheduled map-data refresh installer, and a full local verification script. External routing/search/tile fallbacks are disabled by default and require explicit owner activation.

The NODE01 promotion pipeline now targets this owned stack rather than the earlier lightweight app container. It waits for Valhalla, Nominatim and Martin to become ready, then verifies search, routing, tiles, PWA assets and public HTTPS. Backup and isolated restore procedures cover the owned database, map and routing data.

Public-live status remains evidence-based: a real IZAKHONO-controlled runtime must complete the South Africa imports/builds and pass `stack/scripts/verify.sh` plus `infra/contabo/production-verify-nav.js`. The deployment workflow requires an online self-hosted runner labelled `node01`; no production activation or public DNS cutover is claimed from this chat.
