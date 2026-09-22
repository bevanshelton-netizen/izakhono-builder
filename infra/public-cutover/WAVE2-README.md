# IZAKHONO Public Cutover — Wave 2 Readiness

Wave 2 covers:

- EDU-BUILD ECD360
- LegacyMart

Wave 2 is intentionally **blocked before NODE01 deployment** until an external safety route is qualified for each application.

## Current evidence

### EDU-BUILD ECD360

Repository deployment records pin:

`https://edubuild-ecd360-staging.onrender.com`

That route is explicitly a **staging** deployment. It may be tested as an emergency bridge candidate, but reachability alone does not make it production.

### LegacyMart

A Render Blueprint exists in the repository, but no verified public Render URL is recorded in the checked-in deployment evidence. Wave 2 therefore leaves its external candidate as `UNASSIGNED`.

## Verification

Run:

`VERIFY-WAVE2-EXTERNAL.ps1 -LegacyMartUrl https://<real-legacymart-host>`

The report checks:

- ECD360 home + `/health.json`
- LegacyMart home + `/health`
- HTTPS-only routes

A reachability pass still requires owner/product classification before any NODE01 deployment.

## Prepared NODE01 profiles

Immutable profiles are already prepared for:

- ECD360 commit `b99401b3610d35a98907e0cb89e8f469a1c88a77`
- LegacyMart commit `70f1de418ee899300c00ffa3b11632c1ab76a843`

They are not wired to an execution launcher while the fallback gate is incomplete.

## Safety boundaries

- ECD360 live-money and governance gates remain authoritative.
- LegacyMart automatic third-party seller payouts remain blocked until gateway/KYC/refund/dispute/settlement/accounting controls are verified.
- No Wave 2 application may become **OWNED LIVE VERIFIED** without the same NODE01, EDGE, DNS, TLS, backup, restore and rollback evidence required by the portfolio circular.
