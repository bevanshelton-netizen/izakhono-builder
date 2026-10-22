# IZAKHONO PAY — Onboarding & Routing

## Merchant lifecycle

`pending_kyb → under_review → verified`

Rejected merchants may return to `pending_kyb` after remediation. Verified merchants may be suspended and must return through review before becoming active again.

## Provider routing

Payment routing is configuration-driven by country, currency, payment method, provider priority and merchant eligibility. Provider health can remove an offline provider from the candidate set and prefer healthy providers over degraded providers.

## Control boundary

IZAKHONO owns the merchant experience, orchestration, routing policy, transaction state, ledger metadata and audit trail. A regulated provider remains responsible for regulated payment execution, custody/settlement and any required regulated functions.

## Pilot rule

The sandbox provider is the default development route. It never moves real money. Production providers require separate credentials, security review, commercial onboarding, merchant verification and applicable regulatory controls.
