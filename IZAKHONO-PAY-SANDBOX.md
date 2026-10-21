# IZAKHONO PAY Sandbox

## Purpose

A provider-independent, no-real-money sandbox for demonstrating and testing the IZAKHONO PAY developer contract.

## Sandbox lifecycle

1. Create a test merchant.
2. Issue a test API credential.
3. Create a payment intent using integer minor units.
4. Simulate approval, decline, timeout, and provider failure.
5. Verify idempotency prevents duplicate payment intents.
6. Emit and verify signed webhook events.
7. Exercise refund and reversal flows.
8. Reconcile provider events against the IZAKHONO ledger.
9. Route failed providers to the configured backup adapter.
10. Inspect usage and licensing meters.

## Safety boundary

Sandbox transactions never move real customer funds. Production settlement remains the responsibility of appropriately authorised payment/acquiring partners until IZAKHONO obtains any authorisations required for its intended activities.

## Provider abstraction

The sandbox exposes a stable IZAKHONO API surface while provider adapters remain replaceable. Test scenarios must not depend on a particular provider implementation.

## Required test scenarios

- `approved`
- `declined`
- `timeout`
- `provider_unavailable`
- `duplicate_idempotency_key`
- `invalid_webhook_signature`
- `refund`
- `reconciliation_match`
- `reconciliation_mismatch`
- `primary_to_backup_failover`

## Readiness language

Passing sandbox tests means the developer contract is demonstrable. It does not establish regulatory authorisation, production security certification, payment-network certification, customer funds custody capability, or live settlement readiness.
