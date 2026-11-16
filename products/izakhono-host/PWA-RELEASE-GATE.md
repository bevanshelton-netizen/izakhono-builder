# IZAKHONO Business Creation Engine — PWA release gate

## Implemented in the Builder application shell

- Web app manifest with canonical app identity, standalone display mode, theme colors and scalable branded icons.
- Service worker registration restricted to secure origins.
- App-shell-only offline cache. API, authentication, and tenant data are explicitly excluded from caching.
- Versioned cache cleanup on service-worker activation.
- Android/Chrome installation can be offered after the app is served from a trusted HTTPS origin.

## Not a deployment claim

This change makes the existing Builder shell installable once deployed over HTTPS. It does not activate an owned runtime, provision a public hostname, create production credentials, or establish a public application URL.

## Required production acceptance

1. Deploy the Builder release to the approved IZAKHONO HOST runtime.
2. Verify public DNS and trusted HTTPS for the canonical application hostname.
3. Verify manifest and both icon resources return successfully with correct content types.
4. Verify service-worker scope, installation eligibility and update lifecycle in Chrome Android.
5. Verify login, owner authorization, API health, database persistence, tenant isolation and all release-gated actions.
6. Confirm no authenticated/API response is cached by the service worker.
7. Install on a physical Android device and verify the launcher icon, standalone launch and logout/session behaviour.
8. Record test evidence and promote only after all checks pass.

The canonical release must remain owned-first and provider-agnostic. A repository commit or CI pass is not evidence of a live public deployment.
