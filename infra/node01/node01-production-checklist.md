# IZAKHONO NAV — NODE01 Production Verification

## Purpose

This is the final operational checklist for promoting an exact GitHub `main` release to NODE01.

## Required sequence

1. Confirm NODE01 runner is online with labels `self-hosted,node01`.
2. Start the `IZAKHONO NAV NODE01 Production Promotion` workflow manually.
3. Supply the exact `main` release SHA.
4. Enter `DEPLOY` as the explicit authorization string.
5. Verify the workflow checks out the exact SHA.
6. Verify the NODE01 deployment executes with `NODE01_ALLOW_DEPLOY=1`.
7. Verify `/health`, `/ready`, and `/version`.
8. Run the production verifier.
9. Generate the NODE01 release receipt.
10. Retain the receipt as deployment evidence.

## Completion rule

NODE01 production is **not** considered LIVE merely because the workflow exists. It becomes LIVE only after the NODE01 runner has executed the promotion and the health/readiness/runtime checks and release receipt have succeeded.

## Safety boundary

The promotion workflow intentionally requires explicit human authorization (`DEPLOY`). This is an infrastructure authorization boundary, not a request for routine product-development permission. The autonomous build loop may prepare, validate, harden, and document the release, but it must not invent production authorization or credentials.
