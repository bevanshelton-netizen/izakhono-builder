# IZAKHONO STREAM — Entitlement Playback Gate V1

## Purpose

This boundary makes the entitlement decision authoritative at playback-session time. A payment event may create or revoke an entitlement, but a player never receives a media grant merely because payment succeeded previously.

## Authorization order

1. Validate tenant and identity context.
2. Validate the current device policy.
3. Look up the current entitlement for the user and product/plan.
4. Require `ACTIVE` status.
5. Enforce entitlement start/end timestamps.
6. Resolve the HLS playback resource only after authorization succeeds.
7. Reject empty media grants.
8. Return a short-lived playback session result with an audit decision.

## Security boundary

The resolver receives an entitlement ID, not payment-provider credentials. The media layer remains responsible for provider-specific HLS/CDN/DRM handling. The control plane never exposes origin credentials or long-lived secrets to the player.

## KORA NETWORK reference cases

The included test vectors cover active, revoked, expired, and device-denied sessions. These are contract vectors only; they do not prove production playback, DRM, CDN, payment, or app-store operation.

## Production gate still outstanding

Before production publication, the entitlement store must be durable and tenant-isolated; payment webhooks must be signature-verified and replay-safe; reconciliation, audit, retry/dead-letter handling, and real provider sandbox tests must pass; and media, DRM, DNS/TLS, backup/restore and failover evidence must be recorded.
