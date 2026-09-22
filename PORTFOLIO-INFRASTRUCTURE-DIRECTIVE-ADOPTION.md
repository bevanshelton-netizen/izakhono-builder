# IZAKHONO Infrastructure Directive Adoption Register

**Date:** 22 September 2026  
**Central policy:** `6d791da96ee2c20a0701258d3d4674e0c50e7291`  
**Reusable caller template:** pinned in Builder main at `5352287630f013519f83616ccdbd3e570fb4830a`

This register tracks the first onboarded repositories against the portfolio-wide infrastructure circular.

| Repository | Adoption | Evidence/status |
|---|---|---|
| `bevanshelton-netizen/allegro-vibez` | Adopted and merged | Manifest v3; immutable policy pin; **EXTERNAL LIVE VERIFIED** based on current READY external production evidence; owned target remains NODE01/EDGE. Merge: `127ee36415a5c975e51413eabb2aee508c6e45c7`. |
| `bevanshelton-netizen/the-chancellor` | Adopted and merged | Manifest v3; immutable policy pin; **EXTERNAL LIVE VERIFIED** based on current READY Vercel production evidence; owned target remains NODE01/EDGE. Merge: `f9d058c5e8657fb31b4c907f6c0d4f919b224c55`. |
| `bevanshelton-netizen/edubuild-ecd360` | Adopted and merged | Manifest v3; **EXTERNAL LIVE VERIFIED — PUBLIC CONTROLLED PILOT**. Render route passed fresh public audit against the dedicated Edu-Build Institute 360 backend; paid traffic, live payments, real child data and payroll finalisation remain fail-closed. Release hardening: `207f9c30213f22872558bf602a21a1ebdf9bd94a`; status record: `6a298bf05211d56a186d84d39c0314f801882345`. |
| `bevanshelton-netizen/bevanshelton-netizen-legacymart` | Adopted and merged | Manifest v3; immutable policy pin; **NOT YET PUBLIC** until a current public route is independently verified. Merge: `70f1de418ee899300c00ffa3b11632c1ab76a843`. |
| `bevanshelton-netizen/Downloads` | Workspace exception | Portfolio migration workspace, not one deployable root application. Each separated child application must receive its own v3 manifest and immutable policy pin. |
| `bevanshelton-netizen/nextradefinx` | Activation blocked / migration pending | No root v3 manifest yet. Customer-money activation remains disabled pending regulated-financial-scope review; infrastructure inheritance does not override that commercial/regulatory gate. |

## Portfolio rule

All current and future deployable platforms must migrate through the same v3 policy before being promoted under the current central Builder standard.

No adoption entry may be interpreted as **OWNED LIVE VERIFIED** unless the circular's real NODE/EDGE/DNS/TLS, backup, restore and rollback gates have passed.


## Cutover execution status — 22 September 2026

### Wave 1 — Allegro-Vibez + The Chancellor

- Operating mode: **HYBRID LIVE** — verified external production continues serving users while NODE01/EDGE is the owned promotion target.
- Hybrid manifest: `infra/public-cutover/wave1-hybrid-live.json`.
- Cutover package merged in Builder commit `ca55a75463be78aa770afdf9881f5d93f3f16e3e`.
- Immutable NODE01 deployment refs are prepared.
- External production fallbacks remain preserved.
- Physical NODE01 execution and real owned-hostname DNS/TLS verification are still required before either platform can be labelled **OWNED LIVE VERIFIED**.
- Current status remains **EXTERNAL LIVE VERIFIED** until those gates pass.

### Wave 2 — Edu-Build ECD360 + LegacyMart

- Fallback-readiness package merged in Builder commit `36f39e9385ce8fc05b425bb9dd46bb1ff5afc6fe`; current evidence register is `infra/public-cutover/wave2-readiness.json` v2.
- Immutable NODE01 profiles are prepared.
- ECD360 is now **EXTERNAL LIVE VERIFIED — PUBLIC CONTROLLED PILOT**. The Render route passed the dedicated-backend release audit after merge, including `/`, `/health.json`, `/go-live.json`, the dedicated `tzjnhmrvqbisiegpgxcg` Supabase browser-public contract and Institute functions. Commercial and protected-data gates remain fail-closed.
- LegacyMart's expected Render route returned HTTP 404 on both `/` and `/health` and is rejected as a fallback.
- LegacyMart's professional storefront is built and passed its Alpha build/health gates. Its Supabase WebStart catalogue backend is **ACTIVE_HEALTHY**, RLS-protected, with one active BEVAN SHELTON™ reference shop and four published listings; checkout remains disabled until payment verification.
- The prepared Cloudflare fallback is blocked because the Builder deployment workflow has no Cloudflare credentials configured.
- The prepared GitHub Pages fallback is blocked because creating the Pages site requires repository administration that the connected GitHub integration does not have.
- Wave 2 is now **PARTIALLY PUBLIC**: ECD360 is a verified external controlled pilot; LegacyMart remains publication-blocked. Neither platform is **OWNED LIVE VERIFIED** until NODE01/EDGE/DNS/TLS gates pass, and ECD360 is not ready for paid traffic until its separate commercial gates pass.
