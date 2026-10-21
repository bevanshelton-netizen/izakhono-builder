# IZAKHONO PAY Control Plane v0.3

## Purpose

The Control Plane is the provider-independent orchestration layer for IZAKHONO PAY. It owns the merchant-facing transaction contract while authorised payment providers and regulated institutions perform the applicable payment and settlement functions.

## Core path

`Merchant -> API -> Idempotency -> Risk/FORTRESS -> Router -> Provider Adapter -> Provider -> Webhook -> Reconciliation -> Ledger -> Merchant`

## Provider independence

Providers are adapters, not the product identity. The default registry supports iKhokha, Paystack and PayFast as replaceable rails. Routing is deterministic by currency, provider health and priority. Explicit provider selection never silently substitutes another provider.

## Safety rules

- No funds custody is introduced by this control-plane module.
- No payment is considered reconciled solely because a provider callback says `paid`.
- Reconciliation requires paid status, matching amount, matching currency and an external provider reference.
- Failed reconciliation is held for review.
- Idempotency keys are scoped to a merchant and cannot be reused for a different request fingerprint.
- Payment state transitions are explicit and fail closed.
- Ledger amounts are integer minor units; floating point money is not used.

## Recovery model

1. Route to the preferred healthy provider.
2. If the selected provider becomes unavailable before a transaction is accepted, the orchestration layer may route a new attempt according to the configured policy.
3. Once a provider has accepted a payment, provider state is authoritative for that transaction and reconciliation prevents duplicate settlement assumptions.
4. Provider/webhook failures are recorded and reconciled rather than guessed.
5. Merchant-facing idempotency prevents retry storms from creating duplicate payment intents.

## Commercial boundary

The control plane is licensable IZAKHONO technology. Provider credentials, merchant agreements, regulated settlement and any required authorisations remain separately controlled. Production activation requires security, compliance, provider certification and operational validation appropriate to the deployment.
