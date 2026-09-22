# IZAKHONO Infrastructure Directive Adoption Register

**Date:** 22 September 2026  
**Central policy:** `6d791da96ee2c20a0701258d3d4674e0c50e7291`  
**Reusable caller template:** pinned in Builder main at `5352287630f013519f83616ccdbd3e570fb4830a`

This register tracks the first onboarded repositories against the portfolio-wide infrastructure circular.

| Repository | Adoption | Evidence/status |
|---|---|---|
| `bevanshelton-netizen/allegro-vibez` | Adopted and merged | Manifest v3; immutable policy pin; **EXTERNAL LIVE VERIFIED** based on current READY external production evidence; owned target remains NODE01/EDGE. Merge: `127ee36415a5c975e51413eabb2aee508c6e45c7`. |
| `bevanshelton-netizen/the-chancellor` | Adopted and merged | Manifest v3; immutable policy pin; **EXTERNAL LIVE VERIFIED** based on current READY Vercel production evidence; owned target remains NODE01/EDGE. Merge: `f9d058c5e8657fb31b4c907f6c0d4f919b224c55`. |
| `bevanshelton-netizen/edubuild-ecd360` | Adopted and merged | Manifest v3; immutable policy pin; **NOT YET PUBLIC** until a current public route is independently verified. Merge: `b99401b3610d35a98907e0cb89e8f469a1c88a77`. |
| `bevanshelton-netizen/bevanshelton-netizen-legacymart` | Adopted and merged | Manifest v3; immutable policy pin; **NOT YET PUBLIC** until a current public route is independently verified. Merge: `70f1de418ee899300c00ffa3b11632c1ab76a843`. |
| `bevanshelton-netizen/Downloads` | Workspace exception | Portfolio migration workspace, not one deployable root application. Each separated child application must receive its own v3 manifest and immutable policy pin. |
| `bevanshelton-netizen/nextradefinx` | Activation blocked / migration pending | No root v3 manifest yet. Customer-money activation remains disabled pending regulated-financial-scope review; infrastructure inheritance does not override that commercial/regulatory gate. |

## Portfolio rule

All current and future deployable platforms must migrate through the same v3 policy before being promoted under the current central Builder standard.

No adoption entry may be interpreted as **OWNED LIVE VERIFIED** unless the circular's real NODE/EDGE/DNS/TLS, backup, restore and rollback gates have passed.


## Cutover execution status — 22 September 2026

### Wave 1 — Allegro-Vibez + The Chancellor

- Cutover package merged in Builder commit `ca55a75463be78aa770afdf9881f5d93f3f16e3e`.
- Immutable NODE01 deployment refs are prepared.
- External production fallbacks remain preserved.
- Physical NODE01 execution and real owned-hostname DNS/TLS verification are still required before either platform can be labelled **OWNED LIVE VERIFIED**.
- Current status remains **EXTERNAL LIVE VERIFIED** until those gates pass.

### Wave 2 — Edu-Build ECD360 + LegacyMart

- Fallback-readiness package merged in Builder commit `36f39e9385ce8fc05b425bb9dd46bb1ff5afc6fe`.
- Immutable NODE01 profiles are prepared.
- ECD360 has a recorded Render staging route only; it is not being treated as production.
- LegacyMart has a Render blueprint but no verified public external URL recorded.
- Wave 2 remains blocked from NODE01 execution until both external safety routes are qualified and product-specific readiness gates pass.
