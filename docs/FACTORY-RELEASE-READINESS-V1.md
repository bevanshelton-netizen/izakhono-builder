# IZAKHONO Factory Release Readiness v1

## Current release path

`Factory request -> Builder SuperAgent -> project autopilot -> validation -> owned-first Worker deployment`

## Release truth

- Public-live status must come from verified deployment evidence.
- The factory itself does not publish directly.
- Production promotion uses the repository `[deploy-builder]` gate.
- Cloudflare is the owned-first production runtime for this Builder repository.
- External deployment providers remain resilience/fallback options; their build-rate-limit status must not be treated as Builder production evidence.

## Acceptance checks

1. Repository validation passes.
2. Production deployment credentials are present in the production environment.
3. `wrangler deploy` completes successfully.
4. Deployment output identifies the deployed Worker/version.
5. The deployed `/api/health` endpoint returns `ok: true`.
6. Only then may a release be reported as live.

## Current external constraint

Some connected Vercel project status checks are reporting `build-rate-limit` failures. Those checks are not used as proof of IZAKHONO Builder production deployment because the Builder production workflow targets the owned Cloudflare runtime.
