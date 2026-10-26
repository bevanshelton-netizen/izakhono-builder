# IZAKHONO PAY™ — Merchant & Portfolio Activation Factory

## Objective

Turn every approved IZAKHONO application and participating merchant into a repeatable IZAKHONO PAY participant without rebuilding the payment integration each time.

**Activation path:**

`Register → Merchant/KYB → Credentials → Sandbox → Acceptance → Security → Evidence → Launch Gate → Controlled Live Approval → E2E → Operations`

## Factory rule

The factory standardises the integration while keeping live activation fail-closed. A successful software build does **not** equal regulatory approval or live money movement.

## Application contract

Every participating application must identify:

- `app_slug`
- `merchant_id`
- environment (`sandbox` or `live`)
- server-side IZAKHONO PAY URL
- server-side API credential
- server-side application slug

Browser code must never receive service-role or privileged payment credentials.

## Automated validation

Before an application can request activation, the factory validates:

1. Application registration.
2. Merchant identity and activation state.
3. Server-side credential configuration.
4. No privileged credential exposure in browser code.
5. Idempotency.
6. Signed webhook handling.
7. Ledger and reconciliation paths.
8. Refund and dispute workflows.
9. Acceptance-suite result.
10. Required launch evidence.
11. Current launch-gate decision.

## Live activation

Live money movement remains **OFF by default**.

The activation factory may request live approval, but it cannot bypass the launch gate. The current IZAKHONO PAY architecture keeps regulated custody, clearing, settlement, acquiring, issuing and e-money functions with authorised partners until IZAKHONO is itself appropriately authorised.

Required evidence tracks currently include:

- `REGULATORY_ACQUIRING_APPROVAL`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_LIVE_PROVIDER_GATE`
- `EXTERNAL_PRODUCTION_E2E`

Only verified evidence and a `GO` launch decision can move a merchant/application toward controlled live activation.

## Portfolio rollout

The factory is designed for repeated activation across IZAKHONO applications including KORA, ALLEGRO-VIBEZ, Edu-Build ECD360, FAISReady, DOXA-SURE, IZAKHONO CLOUD and IZAKHONO GROUP.

## Operating principle

**Build once. Activate repeatedly. Upgrade continuously. Fail closed. Verify everything.**

The long-term goal is to make IZAKHONO PAY the common payment orchestration layer across the IZAKHONO ecosystem while remaining provider-replaceable and evidence-driven.
