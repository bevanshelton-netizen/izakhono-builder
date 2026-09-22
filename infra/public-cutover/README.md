# IZAKHONO Public Cutover — Wave 1

Wave 1 covers:

- ALLEGRO VIBEZ
- THE CHANCELLOR

The objective is to prove the owned route without sacrificing the existing external production safety net.

## Phase A — local NODE01 proof

Run:

`RUN-NODE01-WAVE1-LOCAL.cmd`

The launcher:

1. requires NODE01 readiness;
2. verifies required host-side environment files;
3. verifies at least one external safety route remains reachable;
4. submits immutable production commits through IZAKHONO CONTROL;
5. tries IZAKHONO CODE first;
6. uses the GitHub mirror only when the internal repository itself is unavailable;
7. does **not** use mirror fallback for application/build/health failures;
8. requires the final localhost health endpoint to pass;
9. writes `IZAKHONO-NODE01-WAVE1-REPORT.json` to the Windows Desktop.

No DNS or public EDGE change is performed.

## Phase B — owned hostname and EDGE staging

The repository deliberately does not invent owned hostnames. Once real approved hostnames are known, run:

`infra/public-cutover/STAGE-WAVE1-EDGE.ps1`

with the two hostnames. It verifies local service health and creates Caddy snippets under `infra/public-cutover/generated/`.

The snippets are staged only. They are not copied into the live Caddy import directory automatically.

Run `ACTIVATE-WAVE1-EDGE.ps1` first without `-Apply` for a dry-run health check. Only after the hostname/DNS plan has been reviewed should it be run with `-Apply`; that copies the staged snippets into the live Caddy sites directory, validates the Caddy configuration and reloads the owned EDGE.

## Phase C — DNS/TLS/public acceptance

After the approved DNS records point to the owned EDGE and the staged Caddy routes have been reviewed/activated, run:

`infra/public-cutover/VERIFY-WAVE1-PUBLIC.ps1`

It checks:

- DNS A/AAAA resolution
- TCP 443 reachability
- HTTPS health endpoint
- external fallback continuity
- TLS certificate metadata
- The Chancellor `/api/go-live` readiness gate

Only a passing report is a candidate for updating the platform manifest to **OWNED LIVE VERIFIED**. A failed report means keep/revert to the verified external route.

## Current boundary

This package prepares and verifies the cutover. It does not have authority over the physical owner machine or the DNS registrar from this repository alone, so it never claims the public cutover occurred merely because the package exists.
