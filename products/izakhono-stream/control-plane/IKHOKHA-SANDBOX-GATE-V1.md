# IZAKHONO STREAM — iKhokha Sandbox Gate V1

## Purpose

Define the provider-specific boundary required before IZAKHONO STREAM may claim a verified iKhokha payment-to-entitlement flow.

This document is a test and acceptance contract only. It does not claim live iKhokha credentials, production webhooks, production payment processing, or production entitlement activation.

## Required flow

`iKhokha sandbox payment → provider webhook → signature/authenticity verification → tenant/event deduplication → durable entitlement transaction → entitlement audit → playback authorization`

## Acceptance gates

1. Provider sandbox credentials are stored outside source control.
2. Webhook authenticity/signature verification uses the exact provider specification and rejects malformed, altered, replayed, or unverifiable requests.
3. The event is mapped to the canonical IZAKHONO payment-webhook contract without trusting client-supplied entitlement state.
4. Tenant identity is explicit and cannot be selected from an untrusted browser parameter.
5. Provider event identity is durably deduplicated inside the entitlement transaction.
6. A verified PAID event creates exactly one ACTIVE entitlement for the intended tenant/product/user.
7. REFUNDED, CANCELLED, and FAILED events cannot activate access and revoke existing access where contractually required.
8. Concurrent delivery of the same provider event produces one authoritative entitlement state and one replay-safe audit outcome.
9. Failed persistence rolls back without leaving a partial entitlement or replay marker.
10. Playback revalidates durable entitlement and rights window at authorization time.
11. Sandbox reconciliation confirms provider event totals against persisted entitlement/audit records.
12. Evidence is retained: request fixture, verification result, transaction result, database state, audit record, replay result, and test commit SHA.

## KORA NETWORK acceptance vector

Tenant: `kora-network`

Provider: `IKHOKHA`

Product: `kora-svod-monthly`

Expected successful path:

`PAID → ACTIVE entitlement → playback AUTHORIZED`

Expected replay path:

`same event → no duplicate entitlement → replay recorded/no-op`

Expected refund path:

`REFUNDED → entitlement REVOKED → playback DENIED`

## Production release rule

No production payment or entitlement claim is permitted until the above gates are executed against an isolated iKhokha sandbox using real provider verification semantics and durable database persistence, with evidence retained in the release record.
