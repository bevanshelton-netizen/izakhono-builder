# IZAKHONO ONE — SUPER APP

Canonical source for the IZAKHONO ONE access layer.

## Flagship capabilities

IZAKHONO BUILDER is built into IZAKHONO ONE as the SUPER APP build capability. It remains its own independently deployable engine and source-of-truth service. IZAKHONO ONE exposes the capability through the service registry and an owned service bridge rather than absorbing the Builder engine.

The Builder promise is:

DESCRIBE -> GENERATE -> VALIDATE -> PUBLISH

One product definition can target responsive web/PWA immediately and desktop/mobile-ready packaging through the Builder release gates.

IZAKHONO Venture Factory also remains a flagship capability inside IZAKHONO ONE:

IDEA -> BUILD -> SELL -> MEASURE -> IMPROVE

Venture Factory remains independently deployable and keeps its own execution gates. IZAKHONO SUPER AI is surfaced as the provider-neutral intelligence layer.

## Builder bridge

The owned Node engine exposes:

- `GET /api/builder` — Builder integration descriptor.
- `GET /api/builder/health` — health proxy to the independently running Builder when `IZAKHONO_BUILDER_INTERNAL_URL` is configured.

The bridge never copies a Builder admin secret into IZAKHONO ONE and never converts an unverified route into a public-live claim.

## Engine

The provider-neutral Node engine exposes `GET /health`, `GET /api/search?q=...`, `GET /api/resolve/:slug` and `GET /api/route/:slug`. A route is returned only when the registry marks it `verified` or `external-resilience`; gated services fail closed.

## Static resilience build

`public/` is independently publishable on GitHub Pages or another static provider. The browser-side engine provides search, discovery, routing and health without telemetry or third-party runtime dependencies.

## NODE 01

Run repository-root `RUN-IZAKHONO-ONE-NODE01.cmd`. It builds the same source, binds only to `127.0.0.1:8781`, verifies `/health` and the Builder integration descriptor, and leaves public EDGE/TLS/DNS cutover as a separate gate.

Set `IZAKHONO_BUILDER_INTERNAL_URL` before launch when the independently running Builder has an owned internal URL. The health bridge then verifies that route without exposing it publicly.

## Promotion ladder

SOURCE VERIFIED -> NODE01 INTERNAL PASS -> EDGE/TLS PASS -> PUBLIC HTTPS 200 + VERIFIED EXPERIENCE -> OWNED LIVE VERIFIED.

The external route remains reversible fallback throughout.
