# IZAKHONO STREAM — Entitlement Persistence V1

## Purpose

Make entitlement authorization durable and replay-safe before a playback grant can be issued.

## Required boundary

`PAYMENT WEBHOOK → SIGNATURE VERIFY → EVENT DEDUPLICATION → ENTITLEMENT UPSERT → PLAYBACK AUTHORIZATION`

## Persistence requirements

- Tenant-scoped entitlement records.
- Stable entitlement identifier.
- Source payment transaction and provider.
- ACTIVE / REVOKED state.
- Start and optional end time.
- Durable processed-event record keyed by tenant + provider + event ID.
- Audit timestamps for receipt and entitlement mutation.

## Replay protection

A webhook is accepted only after signature verification. A previously processed event is treated as an idempotent duplicate and must not create a second entitlement or reverse an existing entitlement unexpectedly.

## Production gate

The reference implementation is not a production payment connector. Production requires provider-specific signature verification, durable database transactions, unique constraints, retry/dead-letter handling, reconciliation, audit retention, and sandbox end-to-end tests.
