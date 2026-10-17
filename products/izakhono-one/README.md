# IZAKHONO ONE — SUPER APP

Canonical source for the IZAKHONO ONE access layer and owned control plane.

## Parallel core

IZAKHONO ONE exposes seven controlled pillars:

1. IZAKHONO SEARCH — discovery
2. CONNECTA — community/social
3. ONE AI — intelligence
4. ONE CLOUD — workspace
5. ONE COMMERCE — commerce
6. IZAKHONO NAV — mobility & safety
7. FORTRESS — security/trust

Each pillar has a versioned service contract, replaceable adapter boundary, runtime state and FORTRESS policy gate.

## Security and execution boundary

The platform deliberately distinguishes:

`REGISTERED -> FOUNDATION -> STAGING -> VERIFIED -> EXECUTABLE`

A service is never treated as executable merely because it exists in the registry. Runtime execution requires `verified + healthy`. Sensitive actions are evaluated through the policy/action gate, payment actions can require human review, and every prepared action receives an audit correlation ID.

Current service adapters are **foundation / prepare-only**. They are provider-neutral and replaceable. No adapter is allowed to create side effects until its runtime and policy gates are satisfied.

## Core endpoints

- `GET /health` — engine health and control-plane readiness.
- `GET /api/contracts` — seven service contracts.
- `GET /api/adapters` — provider-neutral adapter registry (prepare-only).
- `GET /api/adapters/:slug` — one adapter's capabilities and execution boundaries.
- `GET /api/runtime` — public runtime state for all seven pillars.
- `GET /api/runtime/:slug` — one pillar runtime state.
- `GET /api/notifications/capabilities` — supported notification channels.
- `POST /api/action` — policy/action preparation only.
- `POST /api/dispatch` — capability + policy + runtime dispatch preparation only.
- `GET /api/policy/:slug?action=...` — policy decision preview.
- `GET /api/resolve/:slug` — service, contract and runtime resolution.
- `GET /api/route/:slug` — controlled route resolution.

## Flagship capabilities

IZAKHONO BUILDER is built into IZAKHONO ONE as the SUPER APP build capability. It remains its own independently deployable engine and source-of-truth service. IZAKHONO ONE exposes the capability through an owned service bridge rather than absorbing the Builder engine.

Builder promise:

`DESCRIBE -> GENERATE -> VALIDATE -> PUBLISH`

IZAKHONO FLOW is the SUPER APP workflow-orchestration capability. It remains independently deployable and coordinates approved commercial events across owned services:

`LEAD -> QUALIFY -> QUOTE -> PAY -> FULFIL -> INVOICE -> SUPPORT -> RETAIN -> REPORT`

Venture Factory remains independently deployable and keeps its own execution gates. IZAKHONO SUPER AI is provider-neutral.

## Owned service bridges

- `GET /api/builder` — Builder integration descriptor.
- `GET /api/builder/health` — health proxy when an owned internal Builder URL is configured.
- `GET /api/flow` — FLOW integration descriptor.
- `GET /api/flow/health` — health proxy when an owned internal FLOW URL is configured.

The bridges never copy administrator secrets into IZAKHONO ONE and never convert an unverified internal route into a public-live claim.

## Static resilience

`public/` is independently publishable on GitHub Pages or another static provider. The browser shell provides search, discovery, routing and health without telemetry or third-party runtime dependencies.

## Owned runtime architecture

Production execution is **node-oriented**:

`IZAKHONO CONTROL -> IZAKHONO NODE -> IZAKHONO ONE`

CONTROL supplies node authorization, deployment intent and audit correlation. An authorized IZAKHONO NODE executes the portable workload and reports health/evidence. Multiple owned nodes are supported; a single workstation is not the production dependency.

See `OWNED-NODE-CONTROL.md` for the node/control contract.

## Bootstrap compatibility

The repository-root `RUN-IZAKHONO-ONE-NODE01.cmd` and `START-APP-FABRIC-NODE01.cmd` remain available for operator/bootstrap compatibility and diagnostics. Their local Windows/Docker execution is not equivalent to production node-fabric validation.

## Promotion ladder

`SOURCE VERIFIED -> CONTROL READY -> NODE READY -> DEPLOYMENT VERIFIED -> PUBLIC EDGE/TLS VERIFIED -> OWNED LIVE`

External routes remain reversible fallbacks throughout. Vercel is not an architectural dependency.
