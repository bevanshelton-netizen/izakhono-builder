# IZAKHONO STREAM™

**Africa's OTT Infrastructure & App Factory**

IZAKHONO STREAM is the reusable OTT control and provisioning layer for KORA NETWORK and future branded streaming services.

## V1 mission

Turn a paid/approved OTT onboarding request into a portable streaming-service release:

`brand → tenant → content → channel → monetisation → access → app manifests → release`

The product is **owned-first, node-agnostic and externally reversible**. It follows the portfolio infrastructure directive: the authoritative source is the approved release artifact, not a runtime node or third-party hosting provider.

## Product surfaces

- **STREAM CONTROL** — tenant, brand, users, roles, catalogues, channels and release state.
- **CONTENT CMS** — VOD assets, live inputs, playlists, EPG metadata, captions and rights windows.
- **CHANNEL FACTORY** — linear/FAST channels assembled from approved programming.
- **ENTITLEMENTS** — free, SVOD, TVOD, PPV and hybrid access rules.
- **PAYMENTS** — payment-provider adapters with iKhokha preferred for eligible South African flows.
- **FORTRESS** — authentication, signed playback sessions, device policy, geo/rules, audit and security boundaries.
- **APP FACTORY** — web/PWA plus manifests and release contracts for Android, iOS, Android TV/Google TV, Samsung TV, LG webOS, VIDAA, Roku, Fire TV and Apple TV.
- **ANALYTICS** — playback, audience, conversion, retention and revenue events.
- **PROVISIONER** — deterministic customer-to-release workflow with evidence gates.

## Media plane

The first implementation uses replaceable media adapters. A reference cloud media plane can use object storage → transcoding → packaging/DRM → CDN delivery, while the application control plane remains IZAKHONO-owned. This permits later migration to IZAKHONO-owned media nodes without rewriting the customer-facing product.

## V1 release rule

V1 does not claim production streaming capability merely because the control-plane UI exists. A service becomes externally usable only after media ingest, playback, entitlement, security, DNS/TLS and backup/restore evidence pass the applicable IZAKHONO status gates.

## Initial tenant

`kora-network` is the first reference tenant. It is a product tenant, not the source of truth for the platform itself.
