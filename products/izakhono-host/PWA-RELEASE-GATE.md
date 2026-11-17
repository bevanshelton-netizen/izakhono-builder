# IZAKHONO Business Creation Engine — PWA release gate

## Implemented in the Builder application shell

- Web app manifest with canonical app identity, standalone display mode, theme colors and scalable branded icons.
- Service worker registration restricted to secure origins.
- App-shell-only offline cache. API, authentication, and tenant data are explicitly excluded from caching.
- Versioned cache cleanup on service-worker activation.
- Automated PWA validation is part of HOST CI: manifest scope, required icons, HTTPS-only registration and API/auth cache exclusions are checked.
- Android/Chrome installation can be offered after the app is served from a trusted HTTPS origin.

## Owned API and data-plane integration — blocking

The static PWA shell is not yet a complete owned-hosted Builder application.

- The current browser application calls Builder APIs including health, module catalogue, project creation/listing, planning, generation, generated-source validation, handoff import, autopilot and repository actions.
- Those application routes currently live in the Worker entrypoint `src/sovereign.ts`, with the root `wrangler.jsonc` binding the application to a Cloudflare D1 database.
- The owned Node HOST runtime at `products/izakhono-host/runtime/control-plane/server.mjs` currently serves provisioned site files and HOST site-management endpoints. It does not implement the Builder project/generation/owner API contract.
- Consequently, copying `public/` into an owned HOST site would make the shell and launcher assets reachable, but the Builder workflows would not function end-to-end.

Before production promotion, implement and test the Builder API on the owned Node control plane and move durable application state to the approved IZAKHONO DATABASE/PostgreSQL service. Preserve owner authorization, project isolation, generation, validation, handoff, repository operations, audit events and release approvals. Do not use Cloudflare D1 or a third-party hosting runtime as an unapproved workaround.

## Not a deployment claim

This change makes the existing Builder shell installable once deployed over HTTPS. It does not activate an owned runtime, port the Builder API to the owned Node runtime, provision a public hostname, create production credentials, or establish a public application URL.

## Required production acceptance

1. Complete the owned Builder API and DATABASE/PostgreSQL integration described above, with migration, concurrency, authorization and tenant-isolation tests.
2. Deploy the Builder release to the approved IZAKHONO HOST runtime.
3. Verify public DNS and trusted HTTPS for the canonical application hostname.
4. Verify manifest and both icon resources return successfully with correct content types.
5. Verify service-worker scope, installation eligibility and update lifecycle in Chrome Android.
6. Verify login, owner authorization, API health, database persistence, tenant isolation and all release-gated actions.
7. Confirm no authenticated/API response is cached by the service worker.
8. Install on a physical Android device and verify the launcher icon, standalone launch and logout/session behaviour.
9. Record test evidence and promote only after all checks pass.

The canonical release must remain owned-first and provider-agnostic. A repository commit or CI pass is not evidence of a live public deployment.
