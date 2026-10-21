# IZAKHONO OTT

## Ownership rule
The OTT application is an IZAKHONO-owned product. The source of truth is the IZAKHONO codebase and owned infrastructure. External deployment/CDN/database providers are adapters only and must remain replaceable.

## V1 layers
- Experience: web player shell, discovery, live, VOD, creator channels, plans.
- Control plane: users, profiles, subscriptions, entitlements, catalog, channels, events, watch history.
- Content plane: ingest, metadata, artwork, subtitles, encoding, packaging, playback authorization.
- Commerce: IZAKHONO PAY subscription checkout, invoices, PPV, reconciliation and entitlement activation.
- Distribution: owned origin/storage first; reversible CDN/edge adapters; web/mobile/TV clients.
- Intelligence: recommendations, search, personalization, content analytics and creator analytics.
- Security: FORTRESS-aligned identity, device/session controls, signed playback tokens, audit logs and abuse controls.

## Commercial tiers (initial framework)
FREE R0; MOBILE R59; PLUS R159; PREMIUM R299+; PPV/event pricing separately. Final prices are subject to rights, operating costs and launch testing.

## Rights rule
No commercial movie, series, music or sports feed is represented as available until the required licence/distribution right is verified. The UI uses preview placeholders until real catalogues are connected.

## Next build sequence
1. Database schema and RLS in IZAKHONO-owned data layer.
2. Authentication and profiles.
3. Content CMS and channel management.
4. Playback/entitlement service.
5. IZAKHONO PAY subscription + PPV integration.
6. Creator onboarding and revenue reporting.
7. Ads/FAST layer.
8. Mobile and TV clients.
9. Owned-origin/CDN adapter and observability.
