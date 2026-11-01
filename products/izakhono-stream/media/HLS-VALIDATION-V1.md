# IZAKHONO STREAM — HLS Validation Gate V1

This gate determines whether a packaged asset is eligible to advance from `PACKAGED` to `PLAYABLE`. It is a validation contract, not a production-live claim.

## Required checks

1. **Manifest integrity** — the HLS master/multivariant playlist is retrievable and syntactically valid.
2. **Variant coverage** — the master playlist references the expected video/audio renditions and bitrate ladder.
3. **Segment reachability** — referenced media segments are retrievable with no broken paths.
4. **TLS** — production delivery endpoints use HTTPS/TLS.
5. **Token policy** — protected playback uses short-lived, audience-scoped authorization rather than origin credentials.
6. **Rights window** — playback is denied outside the asset entitlement window.
7. **DRM policy** — if protected, the declared DRM systems match the target device/application policy.
8. **Fail-closed behavior** — missing entitlement, invalid token, expired rights, or policy mismatch produces a blocked playback result.
9. **Evidence** — every check records timestamp, result, adapter/provider, and diagnostic evidence.
10. **Rollback** — a failed release candidate can be returned to `BLOCKED` without deleting the underlying asset.

## State transition

`RECEIVED → UPLOAD_VERIFIED → QUEUED → PROCESSING → TRANSCODED → PACKAGED → PROTECTED → PUBLISHED → PLAYABLE`

Any failed gate becomes `BLOCKED` with evidence. A provider adapter may implement the media work, but the control plane remains authoritative for tenant isolation, entitlement, release state, and auditability.

## V1 acceptance record

A release candidate is not publishable until media validation passes and the wider release gates also pass: playback, FORTRESS security, DNS/TLS, backup/restore, and failover evidence.

## Design reference

The engine is designed around standard HLS delivery concepts: multivariant playlists, adaptive bitrate renditions, secure delivery, and content protection. The implementation remains provider-neutral so IZAKHONO-owned media infrastructure can replace external adapters without changing tenant contracts.
