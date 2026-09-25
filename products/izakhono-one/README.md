# IZAKHONO ONE

Canonical source for the IZAKHONO ONE access layer.

## Engine
The provider-neutral Node engine exposes `GET /health`, `GET /api/search?q=...`, `GET /api/resolve/:slug` and `GET /api/route/:slug`. A route is returned only when the registry marks it `verified` or `external-resilience`; gated services fail closed.

## Static resilience build
`public/` is independently publishable on GitHub Pages or another static provider. The browser-side engine provides search, discovery, routing and health without telemetry or third-party runtime dependencies.

## NODE 01
Run repository-root `RUN-IZAKHONO-ONE-NODE01.cmd`. It builds the same source, binds only to `127.0.0.1:8781`, verifies `/health`, and leaves public EDGE/TLS/DNS cutover as a separate gate.

## Promotion ladder
SOURCE VERIFIED → NODE01 INTERNAL PASS → EDGE/TLS PASS → PUBLIC HTTPS 200 + VERIFIED EXPERIENCE → OWNED LIVE VERIFIED.

The external route remains reversible fallback throughout.
