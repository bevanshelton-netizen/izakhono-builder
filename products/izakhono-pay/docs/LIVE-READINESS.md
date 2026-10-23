# IZAKHONO PAY — Live Readiness Gates

IZAKHONO PAY must never infer that a merchant is production-ready merely because payment software is functioning.

A merchant becomes **live-ready** only when every required control is explicitly passed or formally waived by an authorised operator.

## Required gates

1. `merchant_onboarding_complete`
2. `kyb_verified`
3. `provider_credentials_verified`
4. `provider_webhook_verified`
5. `production_domain_tls`
6. `production_database`
7. `legal_privacy_ready`
8. `end_to_end_acceptance`

## Boundary

These checks are an internal software readiness control. Passing them does **not** mean IZAKHONO PAY is a licensed payment institution, bank, acquirer, custodian, or settlement provider. Regulated money movement remains with appropriately authorised partners until IZAKHONO obtains any authorisations required for its intended activities.

## Provider principle

Provider credentials are stored as references/status metadata, not raw secrets. Providers remain replaceable. Sandbox remains the safe default until production gates are deliberately passed.

## Operational rule

`ready=true` is allowed only when all eight checks are `passed` or `waived`. A failed or pending check blocks production readiness.
