# IZAKHONO PAY — PORTFOLIO GATEWAY ROLL-OUT

Date: 2026-09-11

## Decision

IZAKHONO PAY is the shared payment-orchestration layer for all deployable IZAKHONO portfolio applications.

Every customer-facing application awaiting deployment is registered against IZAKHONO PAY in `app-registry.json`. Applications integrate in `sandbox` first. No application is allowed to switch itself to `live` merely because the UI is deployed.

## Standard integration contract

Each application uses these server-side environment variables:

- `IZAKHONO_PAY_URL`
- `IZAKHONO_PAY_API_KEY`
- `IZAKHONO_PAY_APP_SLUG`

Browser code must never contain the internal API key or provider merchant secrets.

Trusted application backends create payment intents by calling:

`POST /api/v1/intents`

with:

- `x-izakhono-key`
- `x-izakhono-app`
- a validated amount, currency, customer email and description
- an idempotency key for every commercial action

The common server SDK is `products/izakhono-pay/sdk/server.mjs`.

## Portfolio opened to the gateway

- ALLEGRO-VIBEZ — gateway registered; checkout already wired; sandbox acceptance remains
- The Chancellor — gateway registered for deployment adapter
- Edu-Build ECD360 — gateway registered for deployment adapter
- Legacy Mart — gateway registered for deployment adapter
- FAISReady — gateway registered; current external hosted-payment path may continue until IZAKHONO PAY live acceptance is complete
- KORA — gateway registered for deployment adapter
- DOXA-SURE — gateway registered for deployment adapter
- IZAKHONO CLOUD — gateway registered for deployment adapter
- IZAKHONO GROUP — gateway registered for deployment adapter
- Bevan Shelton Racing — gateway registered for deployment adapter

`nextradefinx` remains payment-disabled because its regulated-financial scope requires a separate review before customer-money functionality is activated.

## Deployment rule

A portfolio application may deploy in `sandbox` with the gateway adapter present. Real-money activation remains blocked until all `liveRequires` gates in `app-registry.json` are satisfied.

## Launch factory behavior

The deployment factory must:

1. read `app-registry.json`;
2. confirm the application slug is registered;
3. confirm browser bundles contain no merchant secrets or internal IZAKHONO PAY key;
4. require a trusted server/edge payment-intent adapter;
5. keep the application in `sandbox` until end-to-end acceptance passes;
6. block `live` when any production-readiness requirement is absent.

This makes payment integration a shared platform capability rather than a bespoke payment build in every project.
