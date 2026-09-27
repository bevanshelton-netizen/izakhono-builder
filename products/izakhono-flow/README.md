# IZAKHONO FLOW

Owned portfolio workflow-orchestration engine for IZAKHONO.

## Purpose

FLOW coordinates the shared commercial path without replacing the systems that own the truth:

`Lead -> Qualify -> Quote -> Pay -> Fulfil -> Invoice -> Support -> Retain -> Report`

FLOW is not a CRM, payment gateway, accounting ledger or AI model. It connects the independently deployable IZAKHONO services through scoped events and a durable internal action outbox.

## Boundaries

- Every event, run and action is scoped by both `entity_id` and `platform_id`.
- `payment.confirmed` is rejected unless it comes from `izakhono-pay`, carries `verification.status=verified`, and includes a payment reference.
- FLOW strips obvious secrets, credentials, card fields, fraud signals and raw prompts from orchestration metadata.
- AI actions are advisory hand-offs only. They may not move money, confirm payment, make regulated decisions or silently send communications.
- EDU-BUILD remains a separate legal/entity scope; FLOW may coordinate an approved EDU-BUILD adapter but never merges its records with IZAKHONO AFRICA.
- External adapters are optional and replaceable. Missing adapters leave actions safely pending/failed rather than bypassing the owned path.

## Services

Default adapter targets:

- IZAKHONO CRM — contacts, deals and commercial pipeline
- IZAKHONO REVENUE — quote/invoice commercial hand-offs
- IZAKHONO PAY — payment-status source of truth
- IZAKHONO TASKS — follow-up and renewal scheduling
- IZAKHONO SUPER AI — advisory summaries/next-step suggestions
- platform — product-specific fulfilment

Configure concrete internal endpoints with server-side `FLOW_ADAPTERS_JSON`; do not put adapter credentials in browser code or source control.

Example structure:

```json
{
  "izakhono-crm":{"url":"http://crm:8080/api/flow","token":"..."},
  "izakhono-revenue":{"url":"http://revenue:8795/api/flow","token":"..."},
  "izakhono-tasks":{"url":"http://tasks:9991/api/flow","token":"..."}
}
```

## Automatic dispatch

When a target exists in server-side `FLOW_ADAPTERS_JSON`, FLOW writes the action to its durable outbox first and then attempts the adapter automatically.

- successful adapter calls mark the action `completed`;
- adapter failures remain visible as `failed` and can be retried;
- targets with no configured adapter remain `pending`;
- FLOW never invents an external endpoint or bypasses a missing adapter.

NODE01 configures the owned CRM, REVENUE and TASKS adapters automatically. PAY, SUPER AI and product-specific fulfilment remain optional until a real endpoint and matching server-side credential exist.

## API

Unscoped:

- `GET /health`
- `GET /api/capabilities`

Scoped routes require:

- `X-Entity-ID`
- `X-Platform-ID`

Routes:

- `POST /api/events`
- `GET /api/summary`
- `GET /api/runs`
- `GET /api/runs/:id`
- `GET /api/events`
- `GET /api/outbox`
- `POST /api/outbox/:id/dispatch`
- `POST /api/outbox/:id/ack`
- `GET /api/audit`

## Authentication

- `FLOW_INGEST_TOKEN` — event intake from approved internal services.
- `FLOW_ADMIN_TOKEN` — owner operations including manual outbox dispatch.
- `FLOW_ALLOW_INSECURE_LOCAL=true` may be used only for local development.

NODE01 production must set `FLOW_ALLOW_INSECURE_LOCAL=false`.

## IZAKHONO ONE

IZAKHONO ONE exposes FLOW through an owned-service bridge while FLOW remains its own engine. The bridge does not copy admin secrets and does not call FLOW public-live until the independent HTTPS/experience gate passes.

## Validation

```bash
cd products/izakhono-flow
npm run check
npm test
docker build -t izakhono/flow:0.1.0 .
```

## Status

Package-ready for CI and NODE01 activation. It is **not public-live** until NODE01 persistence, backup/restore, adapter authentication, EDGE/TLS and independent HTTPS verification pass.
