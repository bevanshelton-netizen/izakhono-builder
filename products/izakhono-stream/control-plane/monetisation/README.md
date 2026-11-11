# IZAKHONO STREAM — Monetisation & Entitlements V1

This boundary makes monetisation authoritative inside the IZAKHONO STREAM control plane.

## Supported models

- FREE
- SVOD
- TVOD
- PPV
- AVOD
- FAST
- HYBRID

Payments may be supplied by provider adapters, including iKhokha for eligible South African flows, but a payment provider is not the source of truth for playback access. Successful payment should result in an entitlement being issued or extended; playback authorization then evaluates the entitlement.

## Playback rule

`PAYMENT → ENTITLEMENT → PLAYBACK AUTHORIZATION → SHORT-LIVED PLAYBACK GRANT`

Playback must re-check:

1. Tenant isolation
2. Asset rights window
3. Plan status
4. Entitlement ownership
5. Entitlement validity window
6. Revocation state
7. Device policy
8. Media/HLS availability

No payment credential, origin credential, or DRM secret is exposed to the client.

## KORA NETWORK reference path

KORA NETWORK can operate with FREE, AVOD, SVOD and PPV catalogue items. V1 uses the same entitlement contract regardless of which payment adapter generated the entitlement.

## Production gate

This is a control-plane reference implementation. It does not claim live payments, live entitlements, production playback, or production DRM. Those require verified provider adapters, persistence, audit evidence, reconciliation, and end-to-end playback tests.
