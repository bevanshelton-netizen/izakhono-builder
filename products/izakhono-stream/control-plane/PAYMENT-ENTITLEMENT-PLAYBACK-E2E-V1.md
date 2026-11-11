# IZAKHONO STREAM — PAYMENT → ENTITLEMENT → PLAYBACK E2E GATE V1

## Purpose

This gate defines the reference acceptance boundary connecting an iKhokha sandbox payment event to authoritative entitlement state and then to a short-lived HLS playback grant.

## Acceptance chain

1. Receive provider-normalized iKhokha event.
2. Verify tenant and identity scope.
3. Apply PAID event exactly once using durable event identity.
4. Confirm ACTIVE entitlement exists for the intended product.
5. Re-evaluate entitlement at playback time.
6. Apply device policy.
7. Resolve the protected HLS manifest.
8. Issue a short-lived playback token/session.
9. Record the authorization outcome for audit.

## Required assertions

- PAID creates exactly one ACTIVE entitlement.
- Replayed event does not create a duplicate entitlement.
- REFUNDED/CANCELLED/FAILED cannot authorize playback.
- Expired or not-yet-started entitlement cannot authorize playback.
- Unauthorized devices cannot receive media grants.
- Playback resolution is unavailable unless the entitlement gate has passed.
- Authorized playback returns an HLS master playlist reference ending in `master.m3u8` and a short-lived token.
- Tenant and identity mismatches are rejected.

## Production evidence still required

This harness is a reference acceptance boundary. It does not claim that iKhokha sandbox credentials, cryptographic webhook verification, remote PostgreSQL/Supabase execution, reconciliation, backup/restore, DRM licensing, CDN delivery, or production playback have been executed.

Production promotion requires retained executable test output, isolated database evidence, provider sandbox evidence, reconciliation evidence, and end-to-end playback evidence.
