# IZAKHONO PORTFOLIO ONBOARDING — 2026-09-11

This file records the active project intake into the owner-controlled IZAKHONO workspace and makes IZAKHONO PAY the shared payment-orchestration layer for deployable portfolio applications.

## Owner-controlled workspace

Projects are governed through the shared stack:

IZAKHONO INTELLIGENCE -> IZAKHONO ID -> IZAKHONO ACCESS -> IZAKHONO AI GATEWAY -> owner-controlled model/runtime capacity

The workspace does not impose an application-level chat/session quota. Capacity is governed by the compute, storage, bandwidth and model runtimes provisioned by IZAKHONO.

## Onboarded repositories

- `bevanshelton-netizen/allegro-vibez` — active deployment candidate
- `bevanshelton-netizen/the-chancellor` — active deployment candidate
- `bevanshelton-netizen/edubuild-ecd360` — active deployment candidate
- `bevanshelton-netizen/bevanshelton-netizen-legacymart` — active deployment candidate
- `bevanshelton-netizen/Downloads` — portfolio migration workspace; child applications require their own manifests as they are separated
- `bevanshelton-netizen/nextradefinx` — onboarded for build continuity, but customer-money activation remains disabled pending regulated-financial-scope review

Infrastructure repositories such as `izakhono-builder` and `SHELTON-FORTRESS` are control-plane/infrastructure assets rather than customer checkout applications.

## Shared payment standard

All ordinary portfolio commerce integrates once with **IZAKHONO PAY**. Applications must not embed merchant secrets in browsers. Each app requests a payment intent through a trusted server/edge function, and that trusted component calls the IZAKHONO PAY internal intent API using the app slug and internal credential.

Flow:

1. Customer chooses a product/service in a portfolio app.
2. App sends a purchase request to its own trusted backend/edge function.
3. Backend validates the product, amount, user and return URL.
4. Backend calls `POST /api/v1/intents` on IZAKHONO PAY with `x-izakhono-app` set to the registered slug.
5. IZAKHONO PAY selects the configured provider and returns hosted checkout or a signed PayFast form post.
6. App treats the order as `pending` until IZAKHONO PAY's verified ledger reports `paid`.
7. Webhook verification and reconciliation remain centralized in IZAKHONO PAY.

## Payment modes

- `mock`: local/safe simulation only
- `sandbox`: provider test credentials only
- `live`: production credentials and real-money checkout

No application may be switched to `live` merely because its UI is deployed. Live activation requires merchant onboarding, production credentials, webhook registration, TLS/domain, production database, legal/privacy readiness and a successful end-to-end payment acceptance test.

## Current portfolio rule

`products/izakhono-pay/app-registry.json` is the source-of-truth registry for payment-enabled portfolio applications. New portfolio applications should be registered there before deployment.

## Deployment objective

The deployment factory should consume the app registry, verify the payment mode, validate that browser code contains no merchant secrets, and block any release marked `live` if the required payment-readiness gates are incomplete.
