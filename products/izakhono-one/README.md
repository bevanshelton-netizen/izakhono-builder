# IZAKHONO ONE — SUPER APP

Canonical source for the IZAKHONO ONE access layer.

## Flagship capabilities

IZAKHONO BUILDER is built into IZAKHONO ONE as the SUPER APP build capability. It remains its own independently deployable engine and source-of-truth service. IZAKHONO ONE exposes the capability through the service registry and an owned service bridge rather than absorbing the Builder engine.

The Builder promise is:

DESCRIBE -> GENERATE -> VALIDATE -> PUBLISH

One product definition can target responsive web/PWA immediately and desktop/mobile-ready packaging through the Builder release gates.

IZAKHONO FLOW is the SUPER APP workflow-orchestration capability. It remains an independently deployable engine and coordinates approved commercial events across the existing owned services rather than replacing their sources of truth:

LEAD -> QUALIFY -> QUOTE -> PAY -> FULFIL -> INVOICE -> SUPPORT -> RETAIN -> REPORT

FLOW connects to IZAKHONO CRM, REVENUE, PAY, TASKS, SUPER AI and platform-specific fulfilment through replaceable internal adapters. It preserves entity/platform isolation, accepts payment confirmation only from verified IZAKHONO PAY events, and treats AI output as advisory.

IZAKHONO Venture Factory also remains a flagship capability inside IZAKHONO ONE:

IDEA -> BUILD -> SELL -> MEASURE -> IMPROVE

Venture Factory remains independently deployable and keeps its own execution gates. IZAKHONO SUPER AI is surfaced as the provider-neutral intelligence layer.

## Owned service bridges

The owned Node engine exposes:

- `GET /api/builder` — Builder integration descriptor.
- `GET /api/builder/health` — health proxy to the independently running Builder when `IZAKHONO_BUILDER_INTERNAL_URL` is configured.
- `GET /api/flow` — FLOW integration descriptor.
- `GET /api/flow/health` — health proxy to the independently running FLOW engine when `IZAKHONO_FLOW_INTERNAL_URL` is configured.

The bridges never copy service administrator secrets into IZAKHONO ONE and never convert an unverified internal route into a public-live claim.

## Engine

The provider-neutral Node engine exposes `GET /health`, `GET /api/search?q=...`, `GET /api/resolve/:slug` and `GET /api/route/:slug`. A route is returned only when the registry marks it `verified` or `external-resilience`; gated services fail closed.

## Static resilience build

`public/` is independently publishable on GitHub Pages or another static provider. The browser-side engine provides search, discovery, routing and health without telemetry or third-party runtime dependencies.

## NODE 01

Run repository-root `RUN-IZAKHONO-ONE-NODE01.cmd`. It builds the same source, binds only to `127.0.0.1:8781`, verifies `/health` and the owned integration descriptors, and leaves public EDGE/TLS/DNS cutover as a separate gate.

Set `IZAKHONO_BUILDER_INTERNAL_URL` when the independently running Builder has an owned internal URL.

Set `IZAKHONO_FLOW_INTERNAL_URL` to the independently running FLOW engine's owned internal URL (for the APP FABRIC compose stack, the private service route is `http://flow:8794` from another service on the same private network).

## Promotion ladder

SOURCE VERIFIED -> NODE01 INTERNAL PASS -> EDGE/TLS PASS -> PUBLIC HTTPS 200 + VERIFIED EXPERIENCE -> OWNED LIVE VERIFIED.

The external route remains reversible fallback throughout.
